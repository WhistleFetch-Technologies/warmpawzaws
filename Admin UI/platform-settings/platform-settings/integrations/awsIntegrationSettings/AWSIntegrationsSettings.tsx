/**
 * AWS Integrations Settings - Password Protected
 * Comprehensive AWS service configuration for Warmpawz Platform
 * Includes: S3, SNS, SQS, Chime, Bedrock AI with password protection
 */

import { useState, useEffect } from "react";
import {
	Card,
	CardHeader,
	CardTitle,
	CardContent,
	CardDescription,
	Input,
	Label,
	Button,
	Switch,
	Tabs,
	TabsList,
	TabsTrigger,
	TabsContent,
	Badge,
	Alert,
	AlertDescription,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@repo/ui";

import { projectId, publicAnonKey } from "@repo/utils/supabase/info";
import { toast } from "sonner";
import {
	Cloud,
	Database,
	MessageSquare,
	Map,
	Loader2,
	CheckCircle2,
	AlertCircle,
	Key,
	Shield,
	Video,
	Brain,
	Lock,
	Unlock,
	Save,
	X,
	Mail,
	Radio,
	Server,
	Zap,
	Phone,
} from "lucide-react";

interface AWSSettings {
	credentials: {
		accessKeyId: string;
		secretAccessKey: string;
		region: string;
	};
	s3: {
		enabled: boolean;
		bucket: string;
		region: string;
	};
	sns: {
		enabled: boolean;
		region: string;
		smsOriginationNumber: string;
		emailSourceAddress: string;
	};
	sqs: {
		enabled: boolean;
		queueUrl: string;
		region: string;
	};
	chime: {
		enabled: boolean;
		region: string;
	};
	bedrock: {
		enabled: boolean;
		region: string;
		modelId: string;
	};
}

interface RazorpaySettings {
	bankVerificationEnabled: boolean;
	key_id: string;
	key_secret: string;
}

interface GoogleMapsSettings {
	enabled: boolean;
	apiKey: string;
	region: string;
}

const ADMIN_PASSCODE = "Warmpawz2025";

export function AWSIntegrationsSettings() {
	const [isEditMode, setIsEditMode] = useState(false);
	const [showPasswordDialog, setShowPasswordDialog] = useState(false);
	const [passwordInput, setPasswordInput] = useState("");
	const [loading, setLoading] = useState(false);
	const [initialLoading, setInitialLoading] = useState(true);

	const [aws, setAws] = useState<AWSSettings>({
		credentials: { accessKeyId: "", secretAccessKey: "", region: "ap-south-1" },
		s3: { enabled: false, bucket: "", region: "ap-south-1" },
		sns: {
			enabled: false,
			region: "ap-south-1",
			smsOriginationNumber: "",
			emailSourceAddress: "",
		},
		sqs: { enabled: false, queueUrl: "", region: "ap-south-1" },
		chime: { enabled: false, region: "us-east-1" },
		bedrock: {
			enabled: false,
			region: "us-east-1",
			modelId: "anthropic.claude-v2",
		},
	});

	const [razorpay, setRazorpay] = useState<RazorpaySettings>({
		bankVerificationEnabled: false,
		key_id: "",
		key_secret: "",
	});

	const [googleMaps, setGoogleMaps] = useState<GoogleMapsSettings>({
		enabled: false,
		apiKey: "",
		region: "IN",
	});

	const [savedAws, setSavedAws] = useState<AWSSettings | null>(null);
	const [savedRazorpay, setSavedRazorpay] = useState<RazorpaySettings | null>(
		null
	);
	const [savedGoogleMaps, setSavedGoogleMaps] =
		useState<GoogleMapsSettings | null>(null);

	const hasChanges =
		(savedAws && JSON.stringify(aws) !== JSON.stringify(savedAws)) ||
		(savedRazorpay &&
			JSON.stringify(razorpay) !== JSON.stringify(savedRazorpay)) ||
		(savedGoogleMaps &&
			JSON.stringify(googleMaps) !== JSON.stringify(savedGoogleMaps));

	useEffect(() => {
		loadSettings();
	}, []);

	const loadSettings = async () => {
		try {
			setInitialLoading(true);

			// Load AWS settings
			const awsResponse = await fetch(
				`https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/settings/aws`,
				{
					headers: { Authorization: `Bearer ${publicAnonKey}` },
				}
			);

			// Load Razorpay settings
			const razorpayResponse = await fetch(
				`https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/settings/payment-gateway`,
				{
					headers: { Authorization: `Bearer ${publicAnonKey}` },
				}
			);

			// Load Google Maps settings
			const mapsResponse = await fetch(
				`https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/settings/google-maps`,
				{
					headers: { Authorization: `Bearer ${publicAnonKey}` },
				}
			);

			if (awsResponse.ok) {
				const data = await awsResponse.json();
				if (data.settings) {
					const loadedAws = {
						credentials: {
							accessKeyId: data.settings.credentials?.accessKeyId || "",
							secretAccessKey: data.settings.credentials?.secretAccessKey || "",
							region: data.settings.credentials?.region || "ap-south-1",
						},
						s3: {
							enabled: data.settings.s3?.enabled || false,
							bucket: data.settings.s3?.bucket || "",
							region: data.settings.s3?.region || "ap-south-1",
						},
						sns: {
							enabled: data.settings.sns?.enabled || false,
							region: data.settings.sns?.region || "ap-south-1",
							smsOriginationNumber:
								data.settings.sns?.smsOriginationNumber || "",
							emailSourceAddress: data.settings.sns?.emailSourceAddress || "",
						},
						sqs: {
							enabled: data.settings.sqs?.enabled || false,
							queueUrl: data.settings.sqs?.queueUrl || "",
							region: data.settings.sqs?.region || "ap-south-1",
						},
						chime: {
							enabled: data.settings.chime?.enabled || false,
							region: data.settings.chime?.region || "us-east-1",
						},
						bedrock: {
							enabled: data.settings.bedrock?.enabled || false,
							region: data.settings.bedrock?.region || "us-east-1",
							modelId: data.settings.bedrock?.modelId || "anthropic.claude-v2",
						},
					};
					setAws(loadedAws);
					setSavedAws(JSON.parse(JSON.stringify(loadedAws)));
				}
			}

			if (razorpayResponse.ok) {
				const data = await razorpayResponse.json();
				if (data.settings?.razorpay) {
					const loadedRazorpay = {
						bankVerificationEnabled:
							data.settings.razorpay.bankVerificationEnabled || false,
						key_id: data.settings.razorpay.key_id || "",
						key_secret: data.settings.razorpay.key_secret || "",
					};
					setRazorpay(loadedRazorpay);
					setSavedRazorpay(JSON.parse(JSON.stringify(loadedRazorpay)));
				}
			}

			if (mapsResponse.ok) {
				const data = await mapsResponse.json();
				if (data.settings) {
					const loadedMaps = {
						enabled: data.settings.enabled || false,
						apiKey: data.settings.apiKey || "",
						region: data.settings.region || "IN",
					};
					setGoogleMaps(loadedMaps);
					setSavedGoogleMaps(JSON.parse(JSON.stringify(loadedMaps)));
				}
			}
		} catch (error) {
			console.error("Error loading settings:", error);
			toast.error("Failed to load settings");
		} finally {
			setInitialLoading(false);
		}
	};

	const handleEditClick = () => {
		setShowPasswordDialog(true);
		setPasswordInput("");
	};

	const handlePasswordSubmit = () => {
		if (passwordInput === ADMIN_PASSCODE) {
			setIsEditMode(true);
			setShowPasswordDialog(false);
			toast.success("Edit mode enabled");
		} else {
			toast.error("Incorrect passcode");
		}
		setPasswordInput("");
	};

	const handleCancelEdit = () => {
		if (savedAws) setAws(JSON.parse(JSON.stringify(savedAws)));
		if (savedRazorpay) setRazorpay(JSON.parse(JSON.stringify(savedRazorpay)));
		if (savedGoogleMaps)
			setGoogleMaps(JSON.parse(JSON.stringify(savedGoogleMaps)));
		setIsEditMode(false);
		toast.info("Changes discarded");
	};

	const handleSaveAll = async () => {
		try {
			setLoading(true);
			toast.info("Saving all settings...");

			// Save AWS settings
			const awsResponse = await fetch(
				`https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/settings/aws`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${publicAnonKey}`,
					},
					body: JSON.stringify(aws),
				}
			);

			// Save Razorpay settings
			const razorpayResponse = await fetch(
				`https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/settings/payment-gateway`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${publicAnonKey}`,
					},
					body: JSON.stringify({
						razorpay: {
							...razorpay,
							// Preserve other razorpay settings
							enabled: true,
						},
					}),
				}
			);

			// Save Google Maps settings
			const mapsResponse = await fetch(
				`https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/settings/google-maps`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${publicAnonKey}`,
					},
					body: JSON.stringify(googleMaps),
				}
			);

			if (awsResponse.ok && razorpayResponse.ok && mapsResponse.ok) {
				await loadSettings();
				setIsEditMode(false);
				toast.success("All settings saved successfully!");
			} else {
				const awsError = await awsResponse.json();
				const razorpayError = await razorpayResponse.json();
				const mapsError = await mapsResponse.json();
				console.error("Save errors:", { awsError, razorpayError, mapsError });
				toast.error("Failed to save some settings");
			}
		} catch (error) {
			console.error("Error saving settings:", error);
			toast.error("Failed to save settings");
		} finally {
			setLoading(false);
		}
	};

	if (initialLoading) {
		return (
			<div className="flex flex-col items-center justify-center h-[400px] space-y-4">
				<Loader2 className="w-8 h-8 animate-spin text-orange-500" />
				<p className="text-slate-500">Loading configuration...</p>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Edit Mode Controls */}
			<Card
				className={`border-2 ${isEditMode ? "border-orange-500 bg-orange-50/50" : "border-slate-200"}`}
			>
				<CardContent className="pt-6">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-3">
							{isEditMode ? (
								<Unlock className="w-5 h-5 text-orange-600" />
							) : (
								<Lock className="w-5 h-5 text-slate-400" />
							)}
							<div>
								<h3 className="font-semibold text-slate-900">
									{isEditMode ? "Edit Mode Active" : "Settings Locked"}
								</h3>
								<p className="text-sm text-slate-600">
									{isEditMode
										? "You can now modify platform settings"
										: 'Click "Enable Edit Mode" and enter passcode to modify settings'}
								</p>
							</div>
						</div>
						<div className="flex gap-2">
							{!isEditMode ? (
								<Button
									onClick={handleEditClick}
									variant="outline"
									className="gap-2"
								>
									<Lock className="w-4 h-4" />
									Enable Edit Mode
								</Button>
							) : (
								<>
									<Button
										onClick={handleCancelEdit}
										variant="outline"
										className="gap-2"
									>
										<X className="w-4 h-4" />
										Cancel
									</Button>
									<Button
										onClick={handleSaveAll}
										disabled={loading || !hasChanges}
										className="gap-2 bg-orange-600 hover:bg-orange-700"
									>
										{loading ? (
											<Loader2 className="w-4 h-4 animate-spin" />
										) : (
											<Save className="w-4 h-4" />
										)}
										Save All Changes
									</Button>
								</>
							)}
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Unsaved Changes Warning */}
			{hasChanges && isEditMode && (
				<Alert className="border-orange-200 bg-orange-50">
					<AlertCircle className="h-4 w-4 text-orange-600" />
					<AlertDescription className="text-orange-800">
						You have unsaved changes. Click "Save All Changes" to persist them.
					</AlertDescription>
				</Alert>
			)}

			{/* Main Settings Tabs */}
			<Tabs defaultValue="aws" className="space-y-6">
				<TabsList className="grid w-full grid-cols-3 h-auto p-1 bg-white border rounded-xl">
					<TabsTrigger value="aws" className="flex flex-col gap-2 py-3">
						<Cloud className="w-5 h-5" />
						<span>AWS Services</span>
					</TabsTrigger>
					<TabsTrigger value="razorpay" className="flex flex-col gap-2 py-3">
						<Shield className="w-5 h-5" />
						<span>Razorpay</span>
					</TabsTrigger>
					<TabsTrigger value="maps" className="flex flex-col gap-2 py-3">
						<Map className="w-5 h-5" />
						<span>Google Maps</span>
					</TabsTrigger>
				</TabsList>

				{/* AWS Services Tab */}
				<TabsContent value="aws" className="space-y-6">
					{/* AWS Credentials */}
					<Card className="border-t-4 border-t-orange-500">
						<CardHeader>
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									<Shield className="w-5 h-5 text-orange-600" />
									<CardTitle>AWS IAM Credentials</CardTitle>
								</div>
								<Badge variant="secondary">Global Configuration</Badge>
							</div>
							<CardDescription>
								Single IAM user with permissions for S3, SNS, SQS, Chime, and
								Bedrock
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="space-y-2">
								<Label>AWS Access Key ID</Label>
								<div className="relative">
									<Key className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
									<Input
										type="password"
										value={aws.credentials.accessKeyId}
										onChange={(e) =>
											setAws({
												...aws,
												credentials: {
													...aws.credentials,
													accessKeyId: e.target.value,
												},
											})
										}
										className="pl-10 font-mono"
										placeholder="AKIA..."
										disabled={!isEditMode}
									/>
								</div>
							</div>
							<div className="space-y-2">
								<Label>AWS Secret Access Key</Label>
								<div className="relative">
									<Shield className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
									<Input
										type="password"
										value={aws.credentials.secretAccessKey}
										onChange={(e) =>
											setAws({
												...aws,
												credentials: {
													...aws.credentials,
													secretAccessKey: e.target.value,
												},
											})
										}
										className="pl-10 font-mono"
										placeholder="Secret access key"
										disabled={!isEditMode}
									/>
								</div>
							</div>
							<div className="space-y-2">
								<Label>Default Region</Label>
								<Input
									value={aws.credentials.region}
									onChange={(e) =>
										setAws({
											...aws,
											credentials: {
												...aws.credentials,
												region: e.target.value,
											},
										})
									}
									placeholder="ap-south-1"
									disabled={!isEditMode}
								/>
							</div>
						</CardContent>
					</Card>

					{/* S3 Storage */}
					<Card className="border-l-4 border-l-blue-500">
						<CardHeader>
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									<Database className="w-5 h-5 text-blue-600" />
									<div>
										<CardTitle>Amazon S3 Storage</CardTitle>
										<CardDescription>
											All media files: photos, videos, documents, catalog,
											facility images
										</CardDescription>
									</div>
								</div>
								<Switch
									checked={aws.s3.enabled}
									onCheckedChange={(checked) =>
										setAws({
											...aws,
											s3: { ...aws.s3, enabled: checked },
										})
									}
									disabled={!isEditMode}
								/>
							</div>
						</CardHeader>
						{aws.s3.enabled && (
							<CardContent className="space-y-4">
								<div className="grid grid-cols-2 gap-4">
									<div className="space-y-2">
										<Label>S3 Bucket Name</Label>
										<Input
											value={aws.s3.bucket}
											onChange={(e) =>
												setAws({
													...aws,
													s3: { ...aws.s3, bucket: e.target.value },
												})
											}
											placeholder="warmpawz-media-prod"
											disabled={!isEditMode}
										/>
									</div>
									<div className="space-y-2">
										<Label>Region</Label>
										<Input
											value={aws.s3.region}
											onChange={(e) =>
												setAws({
													...aws,
													s3: { ...aws.s3, region: e.target.value },
												})
											}
											placeholder="ap-south-1"
											disabled={!isEditMode}
										/>
									</div>
								</div>
								<div className="bg-blue-50 p-4 rounded-lg">
									<p className="text-sm text-blue-900">
										<strong>Usage:</strong> Product photos, pet photos, vendor
										facility images, videos, documents, certificates, and all
										user-uploaded media.
									</p>
								</div>
							</CardContent>
						)}
					</Card>

					{/* SNS for SMS/Email */}
					<Card className="border-l-4 border-l-pink-500">
						<CardHeader>
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									<Mail className="w-5 h-5 text-pink-600" />
									<div>
										<CardTitle>Amazon SNS - SMS & Email</CardTitle>
										<CardDescription>
											OTP verification, booking notifications, order updates
										</CardDescription>
									</div>
								</div>
								<Switch
									checked={aws.sns.enabled}
									onCheckedChange={(checked) =>
										setAws({
											...aws,
											sns: { ...aws.sns, enabled: checked },
										})
									}
									disabled={!isEditMode}
								/>
							</div>
						</CardHeader>
						{aws.sns.enabled && (
							<CardContent className="space-y-4">
								<div className="space-y-2">
									<Label>SMS Origination Number</Label>
									<div className="relative">
										<Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
										<Input
											value={aws.sns.smsOriginationNumber}
											onChange={(e) =>
												setAws({
													...aws,
													sns: {
														...aws.sns,
														smsOriginationNumber: e.target.value,
													},
												})
											}
											className="pl-10"
											placeholder="+91XXXXXXXXXX"
											disabled={!isEditMode}
										/>
									</div>
								</div>
								<div className="space-y-2">
									<Label>Email Source Address</Label>
									<div className="relative">
										<Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
										<Input
											type="email"
											value={aws.sns.emailSourceAddress}
											onChange={(e) =>
												setAws({
													...aws,
													sns: {
														...aws.sns,
														emailSourceAddress: e.target.value,
													},
												})
											}
											className="pl-10"
											placeholder="noreply@warmpawz.com"
											disabled={!isEditMode}
										/>
									</div>
								</div>
								<div className="space-y-2">
									<Label>Region</Label>
									<Input
										value={aws.sns.region}
										onChange={(e) =>
											setAws({
												...aws,
												sns: { ...aws.sns, region: e.target.value },
											})
										}
										placeholder="ap-south-1"
										disabled={!isEditMode}
									/>
								</div>
							</CardContent>
						)}
					</Card>

					{/* SQS Queue */}
					<Card className="border-l-4 border-l-purple-500">
						<CardHeader>
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									<MessageSquare className="w-5 h-5 text-purple-600" />
									<div>
										<CardTitle>Amazon SQS</CardTitle>
										<CardDescription>
											Background job processing queue
										</CardDescription>
									</div>
								</div>
								<Switch
									checked={aws.sqs.enabled}
									onCheckedChange={(checked) =>
										setAws({
											...aws,
											sqs: { ...aws.sqs, enabled: checked },
										})
									}
									disabled={!isEditMode}
								/>
							</div>
						</CardHeader>
						{aws.sqs.enabled && (
							<CardContent className="space-y-4">
								<div className="space-y-2">
									<Label>Queue URL</Label>
									<Input
										value={aws.sqs.queueUrl}
										onChange={(e) =>
											setAws({
												...aws,
												sqs: { ...aws.sqs, queueUrl: e.target.value },
											})
										}
										className="font-mono text-sm"
										placeholder="https://sqs.ap-south-1.amazonaws.com/..."
										disabled={!isEditMode}
									/>
								</div>
								<div className="space-y-2">
									<Label>Region</Label>
									<Input
										value={aws.sqs.region}
										onChange={(e) =>
											setAws({
												...aws,
												sqs: { ...aws.sqs, region: e.target.value },
											})
										}
										placeholder="ap-south-1"
										disabled={!isEditMode}
									/>
								</div>
							</CardContent>
						)}
					</Card>

					{/* AWS Chime */}
					<Card className="border-l-4 border-l-emerald-500">
						<CardHeader>
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									<Video className="w-5 h-5 text-emerald-600" />
									<div>
										<CardTitle>Amazon Chime SDK</CardTitle>
										<CardDescription>
											Video consultations, voice calls, real-time chat
										</CardDescription>
									</div>
								</div>
								<Switch
									checked={aws.chime.enabled}
									onCheckedChange={(checked) =>
										setAws({
											...aws,
											chime: { ...aws.chime, enabled: checked },
										})
									}
									disabled={!isEditMode}
								/>
							</div>
						</CardHeader>
						{aws.chime.enabled && (
							<CardContent className="space-y-4">
								<div className="space-y-2">
									<Label>Region</Label>
									<Input
										value={aws.chime.region}
										onChange={(e) =>
											setAws({
												...aws,
												chime: { ...aws.chime, region: e.target.value },
											})
										}
										placeholder="us-east-1"
										disabled={!isEditMode}
									/>
									<p className="text-xs text-slate-500">
										Chime SDK is only available in specific regions (us-east-1
										recommended)
									</p>
								</div>
							</CardContent>
						)}
					</Card>

					{/* AWS Bedrock AI */}
					<Card className="border-l-4 border-l-indigo-500">
						<CardHeader>
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									<Brain className="w-5 h-5 text-indigo-600" />
									<div>
										<CardTitle>AWS Bedrock AI</CardTitle>
										<CardDescription>
											AI-powered symptom checker, smart recommendations
										</CardDescription>
									</div>
								</div>
								<Switch
									checked={aws.bedrock.enabled}
									onCheckedChange={(checked) =>
										setAws({
											...aws,
											bedrock: { ...aws.bedrock, enabled: checked },
										})
									}
									disabled={!isEditMode}
								/>
							</div>
						</CardHeader>
						{aws.bedrock.enabled && (
							<CardContent className="space-y-4">
								<div className="space-y-2">
									<Label>Model ID</Label>
									<Input
										value={aws.bedrock.modelId}
										onChange={(e) =>
											setAws({
												...aws,
												bedrock: { ...aws.bedrock, modelId: e.target.value },
											})
										}
										placeholder="anthropic.claude-v2"
										disabled={!isEditMode}
									/>
									<p className="text-xs text-slate-500">
										Examples: anthropic.claude-v2, anthropic.claude-instant-v1
									</p>
								</div>
								<div className="space-y-2">
									<Label>Region</Label>
									<Input
										value={aws.bedrock.region}
										onChange={(e) =>
											setAws({
												...aws,
												bedrock: { ...aws.bedrock, region: e.target.value },
											})
										}
										placeholder="us-east-1"
										disabled={!isEditMode}
									/>
								</div>
							</CardContent>
						)}
					</Card>
				</TabsContent>

				{/* Razorpay Bank Verification Tab */}
				<TabsContent value="razorpay" className="space-y-6">
					<Card className="border-t-4 border-t-blue-500">
						<CardHeader>
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									<Shield className="w-5 h-5 text-blue-600" />
									<CardTitle>Razorpay Bank Verification</CardTitle>
								</div>
								<Switch
									checked={razorpay.bankVerificationEnabled}
									onCheckedChange={(checked) =>
										setRazorpay({
											...razorpay,
											bankVerificationEnabled: checked,
										})
									}
									disabled={!isEditMode}
								/>
							</div>
							<CardDescription>
								Verify vendor bank accounts during onboarding using Razorpay
								Fund Account API
							</CardDescription>
						</CardHeader>
						{razorpay.bankVerificationEnabled && (
							<CardContent className="space-y-4">
								<div className="space-y-2">
									<Label>Razorpay Key ID</Label>
									<Input
										type="password"
										value={razorpay.key_id}
										onChange={(e) =>
											setRazorpay({
												...razorpay,
												key_id: e.target.value,
											})
										}
										placeholder="rzp_live_xxxxx"
										disabled={!isEditMode}
										className="font-mono"
									/>
								</div>
								<div className="space-y-2">
									<Label>Razorpay Key Secret</Label>
									<Input
										type="password"
										value={razorpay.key_secret}
										onChange={(e) =>
											setRazorpay({
												...razorpay,
												key_secret: e.target.value,
											})
										}
										placeholder="Secret key"
										disabled={!isEditMode}
										className="font-mono"
									/>
								</div>
								<div className="bg-blue-50 p-4 rounded-lg">
									<p className="text-sm text-blue-900">
										<strong>API Endpoint:</strong> Razorpay Fund Account
										Validation API
									</p>
									<p className="text-xs text-blue-700 mt-1">
										Verifies IFSC code, account number, and account holder name
									</p>
								</div>
							</CardContent>
						)}
					</Card>
				</TabsContent>

				{/* Google Maps Tab */}
				<TabsContent value="maps" className="space-y-6">
					<Card className="border-t-4 border-t-green-500">
						<CardHeader>
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									<Map className="w-5 h-5 text-green-600" />
									<CardTitle>Google Maps Platform</CardTitle>
								</div>
								<Switch
									checked={googleMaps.enabled}
									onCheckedChange={(checked) =>
										setGoogleMaps({
											...googleMaps,
											enabled: checked,
										})
									}
									disabled={!isEditMode}
								/>
							</div>
							<CardDescription>
								Address autocomplete, geolocation, logistics routing
							</CardDescription>
						</CardHeader>
						{googleMaps.enabled && (
							<CardContent className="space-y-4">
								<div className="space-y-2">
									<Label>API Key</Label>
									<Input
										type="password"
										value={googleMaps.apiKey}
										onChange={(e) =>
											setGoogleMaps({
												...googleMaps,
												apiKey: e.target.value,
											})
										}
										placeholder="AIza..."
										disabled={!isEditMode}
										className="font-mono"
									/>
								</div>
								<div className="space-y-2">
									<Label>Region Bias</Label>
									<Input
										value={googleMaps.region}
										onChange={(e) =>
											setGoogleMaps({
												...googleMaps,
												region: e.target.value.toUpperCase(),
											})
										}
										placeholder="IN"
										maxLength={2}
										disabled={!isEditMode}
										className="uppercase"
									/>
									<p className="text-xs text-slate-500">
										Two-letter country code (e.g., IN, US)
									</p>
								</div>
							</CardContent>
						)}
					</Card>
				</TabsContent>
			</Tabs>

			{/* Password Dialog */}
			<Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<Lock className="w-5 h-5 text-orange-600" />
							Authentication Required
						</DialogTitle>
						<DialogDescription>
							Enter the admin passcode to enable edit mode for platform
							settings.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div className="space-y-2">
							<Label htmlFor="passcode">Admin Passcode</Label>
							<Input
								id="passcode"
								type="password"
								value={passwordInput}
								onChange={(e) => setPasswordInput(e.target.value)}
								placeholder="Enter passcode"
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										handlePasswordSubmit();
									}
								}}
								autoFocus
							/>
						</div>
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => {
								setShowPasswordDialog(false);
								setPasswordInput("");
							}}
						>
							Cancel
						</Button>
						<Button
							onClick={handlePasswordSubmit}
							className="bg-orange-600 hover:bg-orange-700"
						>
							Unlock Settings
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
