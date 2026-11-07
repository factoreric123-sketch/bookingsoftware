DO $tests$ DECLARE a uuid:='a2000000-0000-4000-8000-000000000001'; u uuid:='8317c8b5-0dfb-4f08-965b-55b3e51fd1da'; BEGIN
 BEGIN
 IF NOT private.actor_business_permission(a,u,'can_view_analytics') OR private.actor_business_permission(a,u,'can_manage_billing') THEN RAISE EXCEPTION 'manager flags failed'; END IF;
 UPDATE public.business_members SET can_manage_billing=true WHERE business_id=a AND user_id=u;
 IF NOT private.actor_business_permission(a,u,'can_manage_billing') THEN RAISE EXCEPTION 'enabled billing flag failed'; END IF;
 UPDATE public.business_members SET role='staff',can_view_analytics=true,can_manage_billing=true WHERE business_id=a AND user_id=u;
 IF private.actor_business_permission(a,u,'can_view_analytics') OR private.actor_business_permission(a,u,'can_manage_billing') THEN RAISE EXCEPTION 'staff permission rejection failed'; END IF;
 BEGIN PERFORM public.create_invoice(u,a,'a4000000-0000-4000-8000-000000000001',NULL,'[]',NULL,'test',gen_random_uuid()); RAISE EXCEPTION 'staff invoice unexpectedly allowed'; EXCEPTION WHEN SQLSTATE 'P0403' THEN NULL; END;
 BEGIN PERFORM public.create_blocked_time(u,a,NULL,NULL,now()+interval '40 days',now()+interval '40 days 1 hour','test'); RAISE EXCEPTION 'staff block unexpectedly allowed'; EXCEPTION WHEN SQLSTATE 'P0403' THEN NULL; END;
 UPDATE public.business_members SET role='manager',active=false WHERE business_id=a AND user_id=u;
 IF private.actor_has_business_access(a,u) OR private.actor_business_role(a,u) IS NOT NULL OR private.actor_business_permission(a,u,'can_view_analytics') THEN RAISE EXCEPTION 'inactive actor failed'; END IF;
 BEGIN PERFORM public.get_business_analytics(u,a,NULL,current_date,current_date); RAISE EXCEPTION 'inactive analytics unexpectedly allowed'; EXCEPTION WHEN SQLSTATE 'P0403' THEN NULL; END;
 BEGIN PERFORM public.create_blocked_time(u,a,NULL,NULL,now()+interval '40 days',now()+interval '40 days 1 hour','test'); RAISE EXCEPTION 'inactive block unexpectedly allowed'; EXCEPTION WHEN SQLSTATE 'P0403' THEN NULL; END;
 IF private.actor_business_permission(a,'47fff988-90c4-4129-b072-146f8e35b701','unknown') OR private.actor_has_business_access(a,NULL) OR private.actor_is_org_admin_for_business(a,u) THEN RAISE EXCEPTION 'unknown/null/cross-org failed'; END IF;
 INSERT INTO public.organization_members(organization_id,user_id,role) VALUES ('a1000000-0000-4000-8000-000000000001',u,'admin');
 IF NOT private.actor_is_org_admin_for_business(a,u) OR NOT private.actor_business_permission(a,u,'can_manage_billing') THEN RAISE EXCEPTION 'org admin access failed'; END IF;
 UPDATE public.organization_members SET active=false WHERE organization_id='a1000000-0000-4000-8000-000000000001' AND user_id=u;
 IF private.actor_is_org_admin_for_business(a,u) THEN RAISE EXCEPTION 'inactive org admin allowed'; END IF;
 RAISE EXCEPTION 'rollback successful regression fixtures' USING ERRCODE='P0999';
 EXCEPTION WHEN SQLSTATE 'P0999' THEN RAISE NOTICE 'PASS: manager flags, staff RPC rejection, inactive RPC rejection, null actor, unknown permission, org admin role/scope/active; all fixture edits rolled back'; END;
END $tests$;