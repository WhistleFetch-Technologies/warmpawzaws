import { EnterpriseLogicTab } from "@/components/admin/enterprise";
import { AdminRouteGuard } from "@/components/admin/layout/AdminRouteGuard";

const page = () => {
	return (
		<AdminRouteGuard>
			<EnterpriseLogicTab />
		</AdminRouteGuard>
	);
};

export default page;

