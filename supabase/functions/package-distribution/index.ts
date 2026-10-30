import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS=new Set(["https://kngslhdn.github.io","https://visitor.myhikj.com","http://visitor.myhikj.com","http://localhost:3000","http://127.0.0.1:5500"]);
const corsHeaders=(req:Request)=>{
  const origin=req.headers.get("Origin")||"";
  return {"Access-Control-Allow-Origin":ALLOWED_ORIGINS.has(origin)?origin:"https://kngslhdn.github.io","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"GET,POST,OPTIONS","Vary":"Origin","Content-Type":"application/json"};
};
const json = (req:Request, body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: corsHeaders(req) });
const APP_VERSION = "ks.v.001";
const APP_TITLE = "SECUREOPS | Security Operations";
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(supabaseUrl, serviceRoleKey);

async function requireAdmin(req: Request) {
  const auth = req.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) throw new Error("Unauthorized");
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) throw new Error("Unauthorized");
  const { data: profile, error: profileError } = await sb.from("admin_profiles").select("user_id,active,role,property_id").eq("user_id", data.user.id).eq("active", true).maybeSingle();
  const role = String(profile?.role || "").toUpperCase();
  if (profileError || !profile || !["ADMIN", "MANAGER", "SUPERADMIN"].includes(role)) throw new Error("Forbidden");
  if (role !== "SUPERADMIN" && !profile.property_id) throw new Error("Property assignment required");
  const db = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  return { user: data.user, profile, db };
}

function isUuid(value: string) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  try {
    const { db, profile } = await requireAdmin(req);

    if (req.method === "GET") {
      const url = new URL(req.url);
      const q = (url.searchParams.get("q") || "").trim();
      // Use the service-role client for the read path after requireAdmin().
      // This keeps Package Distribution independent from public RLS visibility,
      // while still enforcing the authenticated Security Admin check above.
      let query = sb.from("package_registrations")
        .select("id,submission_id,courier_name,phone,company_name,item_type,item_count,recipient_type,recipient_name,security_officer_name,created_at,property_id")
        .order("created_at", { ascending: false }).limit(100);
      if (String(profile?.role || "").toUpperCase() !== "SUPERADMIN") {
        query = query.eq("property_id", profile.property_id);
      }

      const { data: distributed, error: de } = await sb.from("package_distributions").select("package_registration_id");
      if (de) throw de;
      const distributedIds = (distributed || []).map((r) => r.package_registration_id);
      if (distributedIds.length) query = query.not("id", "in", `(${distributedIds.join(",")})`);

      if (isUuid(q)) {
        // Scope the service-role exact lookup to the authenticated property's records.
        // The normal list query above is property-scoped; this branch must enforce the same boundary.
        let exactQuery = sb.from("package_registrations")
          .select("id,submission_id,courier_name,phone,company_name,item_type,item_count,recipient_type,recipient_name,security_officer_name,created_at,property_id")
          .eq("submission_id", q);
        if (String(profile?.role || "").toUpperCase() !== "SUPERADMIN") {
          exactQuery = exactQuery.eq("property_id", profile.property_id);
        }
        const { data: exact, error: exactError } = await exactQuery.maybeSingle();
        if (exactError) throw exactError;
        if (exact && !distributedIds.includes(exact.id)) {
          const { data: sub, error: subError } = await sb.from("submissions").select("submission_id").eq("id", exact.submission_id).maybeSingle();
          if (subError) throw subError;
          const publicId = sub?.submission_id || exact.submission_id;
          return json({ packages: [{ ...exact, submission_id: publicId, package_number: publicId, status: "READY FOR DISTRIBUTION" }] });
        }
      }

      const { data, error } = await query;
      if (error) return json({ error: error.message }, 400);
      const rows = data || [];
      const submissionIds = rows.map((p) => p.submission_id).filter(Boolean);
      const publicMap = new Map<string, string>();
      if (submissionIds.length) {
        const { data: subs, error: se } = await sb.from("submissions").select("id,submission_id").in("id", submissionIds);
        if (se) return json({ error: se.message }, 400);
        for (const s of subs || []) publicMap.set(s.id, s.submission_id);
      }

      const term = q.toLowerCase();
      const filtered = (data || []).filter((p) => {
        if (!term) return true;
        const searchText = [
          p.recipient_name,
          p.courier_name,
          p.company_name,
          p.item_type,
          p.recipient_type,
          publicMap.get(p.submission_id) || p.submission_id,
        ].join(" ").toLowerCase();
        return searchText.includes(term);
      });
      return json({ packages: filtered.map((p) => ({ ...p, submission_id: publicMap.get(p.submission_id) || p.submission_id, package_number: publicMap.get(p.submission_id) || p.submission_id, status: "READY FOR DISTRIBUTION" })) });
    }

    if (req.method === "POST") {
      const body = await req.json();
      const packageRegistrationId = String(body.package_registration_id || "").trim();

      if (body.action === "delete_evidence") {
        const storagePath = String(body.storage_path || "").trim();
        if (!isUuid(packageRegistrationId) || !storagePath.startsWith("HIKJ/distribution/")) {
          return json(req, { error: "Invalid evidence reference." }, 400);
        }
        const { data: pkg, error: pkgError } = await db.from("package_registrations")
          .select("id,property_id").eq("id", packageRegistrationId).maybeSingle();
        if (pkgError || !pkg) return json(req, { error: "Package not found." }, 404);
        if (String(profile?.role || "").toUpperCase() !== "SUPERADMIN" && pkg.property_id !== profile.property_id) {
          return json(req, { error: "Forbidden" }, 403);
        }
        const { error: removeError } = await sb.storage.from("package-photos").remove([storagePath]);
        if (removeError) throw removeError;
        return json(req, { success: true });
      }

      if (body.action === "upload_evidence") {
        const photoDataUrl = String(body.photo_data_url || "");
        if (!isUuid(packageRegistrationId)) return json(req, { error: "Package not found." }, 404);
        const { data: pkg, error: pkgError } = await db.from("package_registrations")
          .select("id,property_id").eq("id", packageRegistrationId).maybeSingle();
        if (pkgError || !pkg) return json(req, { error: "Package not found." }, 404);
        if (String(profile?.role || "").toUpperCase() !== "SUPERADMIN" && pkg.property_id !== profile.property_id) {
          return json(req, { error: "Forbidden" }, 403);
        }
        const { data: existing } = await db.from("package_distributions")
          .select("id").eq("package_registration_id", packageRegistrationId).maybeSingle();
        if (existing) return json(req, { error: "Package has already been distributed." }, 409);
        const match = photoDataUrl.match(/^data:(image[/](?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
        if (!match) return json(req, { error: "Evidence photo must be JPEG, PNG, or WebP." }, 400);
        const bytes = Uint8Array.from(atob(match[2]), ch => ch.charCodeAt(0));
        if (!bytes.length || bytes.length > 5 * 1024 * 1024) {
          return json(req, { error: "Evidence photo must not exceed 5 MB." }, 413);
        }
        const mimeType = match[1];
        const extension = mimeType === "image/jpeg" ? "jpg" : mimeType.split("/")[1];
        const storagePath = `HIKJ/distribution/${new Date().toISOString().slice(0,10)}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await sb.storage.from("package-photos").upload(storagePath, bytes, {
          contentType: mimeType, upsert: false
        });
        if (uploadError) {
          console.error("distribution evidence upload failed", uploadError);
          return json(req, { error: "Unable to upload distribution evidence photo. Please try again." }, 500);
        }
        return json(req, { success: true, storage_path: storagePath });
      }

      const securityHandOver = String(body.security_hand_over || "").trim();
      const recipientName = String(body.recipient_name || "").trim();
      const noteValue = body.note == null ? "" : String(body.note).trim();
      const evidencePath = String(body.evidence_storage_path || "").trim();
      if (!isUuid(packageRegistrationId)) return json(req, { error: "Package not found." }, 404);
      if (!securityHandOver) return json(req, { error: "Please enter Security Hand Over." }, 400);
      if (!recipientName) return json(req, { error: "Please enter Recipient / Representative Name." }, 400);
      if (!evidencePath.startsWith("HIKJ/distribution/")) return json(req, { error: "Distribution evidence photo is required." }, 400);

      const { data, error } = await db.rpc("distribute_package", {
        p_package_registration_id: packageRegistrationId,
        p_recipient_name: recipientName,
        p_security_hand_over: securityHandOver,
        p_note: noteValue || null,
        p_evidence_storage_path: evidencePath,
      });
      if (error) {
        const status = error.code === "23505" ? 409 : error.code === "42501" ? 403 : 400;
        return json(req, { error: error.message || "Unable to complete package distribution." }, status);
      }
      return json(req, data || { success: true });
    }
    return json({ error: "Method not allowed." }, 405);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    return json({ error: message === "Forbidden" ? "Forbidden" : "Unauthorized" }, message === "Forbidden" ? 403 : 401);
  }
});
