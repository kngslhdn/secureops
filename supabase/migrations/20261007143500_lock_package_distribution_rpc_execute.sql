revoke execute on function public.distribute_package(uuid,text,text,text) from public, anon;
grant execute on function public.distribute_package(uuid,text,text,text) to authenticated;
