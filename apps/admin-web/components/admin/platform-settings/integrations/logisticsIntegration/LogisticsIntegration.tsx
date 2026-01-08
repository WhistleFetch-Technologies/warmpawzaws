import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@warmpawz/ui";
import { LogisticsSettings } from "./logisticsSettings/LogisticsSettings";
import { DeliveryRulesManager } from "./deliveryRulesManager/DeliveryRulesManager";
import { Package, Route, Settings } from "lucide-react";

export function LogisticsIntegration() {
	const [activeTab, setActiveTab] = useState("partners");

	return (
		<div className="space-y-6">
			<Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
				<TabsList className="grid w-full grid-cols-2">
					<TabsTrigger value="partners" className="flex items-center gap-2">
						<Settings className="w-4 h-4" />
						Partners & Configuration
					</TabsTrigger>
					<TabsTrigger value="rules" className="flex items-center gap-2">
						<Route className="w-4 h-4" />
						Delivery Rules
					</TabsTrigger>
				</TabsList>

				<TabsContent value="partners" className="mt-6">
					<LogisticsSettings />
				</TabsContent>

				<TabsContent value="rules" className="mt-6">
					<DeliveryRulesManager />
				</TabsContent>
			</Tabs>
		</div>
	);
}

