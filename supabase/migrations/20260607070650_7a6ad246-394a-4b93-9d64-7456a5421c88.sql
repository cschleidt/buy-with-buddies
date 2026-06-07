
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_list_member(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_list_owner(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.find_user_id_by_email(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_list_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_list_owner(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_user_id_by_email(TEXT) TO authenticated;
