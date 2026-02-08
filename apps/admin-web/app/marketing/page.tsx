"use client";

import React, { useState, useEffect } from "react";

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Switch,
	Label,
	Badge,
	Card,
	Input,
	Button,
} from "@warmpawz/ui";

import {
	Megaphone,
	Plus,
	Search,
	Trash2,
	Edit,
	LayoutTemplate,
	Save,
	RotateCcw,
	Star,
	Zap,
	Tag,
	Image as ImageIcon,
	FileText,
	Bell,
	Calendar,
	Link as LinkIcon,
	Eye,
	EyeOff,
	ExternalLink,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast, Toaster } from "sonner";
import {
	CouponManagement,
	AdvancedPromotionsEngine,
} from "@/components/admin/marketing";

import { AdminLayout } from '@/components/admin/layout/AdminLayout';

export default function MarketingPromotionsTab() {
	const [activeTab, setActiveTab] = useState<
		| "promotions"
		| "ui-config"
		| "spotlight"
		| "coupons"
		| "advanced"
		| "banners"
		| "articles"
		| "announcements"
	>("promotions");
	const [loading, setLoading] = useState(false);
	
	// Banners State
	const [banners, setBanners] = useState<any[]>([]);
	const [showBannerModal, setShowBannerModal] = useState(false);
	const [editingBanner, setEditingBanner] = useState<any>(null);
	const [bannerForm, setBannerForm] = useState({
		title: "",
		subtitle: "",
		image_url: "",
		cta_text: "Shop Now",
		cta_link: "",
		position: "home_top",
		is_active: true,
		start_date: new Date().toISOString().split("T")[0],
		end_date: "",
		display_order: 0,
		gradient_from: "#FF8C42",
		gradient_to: "#FF6B35",
	});
	
	// Articles State
	const [articles, setArticles] = useState<any[]>([]);
	const [showArticleModal, setShowArticleModal] = useState(false);
	const [editingArticle, setEditingArticle] = useState<any>(null);
	const [articleForm, setArticleForm] = useState({
		title: "",
		slug: "",
		content: "",
		category: "tips",
		read_time: "5 min",
		is_published: false,
		featured: false,
	});
	
	// Announcements State (What's New)
	const [announcements, setAnnouncements] = useState<any[]>([]);
	const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
	const [editingAnnouncement, setEditingAnnouncement] = useState<any>(null);
	const [announcementForm, setAnnouncementForm] = useState({
		title: "",
		subtitle: "",
		badge_text: "NEW",
		badge_color: "green",
		icon: "✨",
		cta_text: "",
		cta_link: "",
		is_active: true,
		display_order: 0,
		announcement_type: "feature", // feature, emergency, premium
	});

	// Spotlight State
	const [spotlights, setSpotlights] = useState<any[]>([]);
	const [availableVendors, setAvailableVendors] = useState<any[]>([]);
	const [spotlightModal, setSpotlightModal] = useState(false);
	const [selectedVendorId, setSelectedVendorId] = useState("");
	const [spotlightDuration, setSpotlightDuration] = useState("7");
	const [spotlightType, setSpotlightType] = useState("featured_vendor");

	// Promotions State
	const [promotions, setPromotions] = useState<any[]>([]);
	const [showPromoModal, setShowPromoModal] = useState(false);
	const [editingPromo, setEditingPromo] = useState<any>(null);
	const [promoForm, setPromoForm] = useState({
		title: "",
		subtitle: "",
		discountType: "percentage",
		discountValue: 0,
		code: "",
		serviceCategory: "all",
		serviceStyle: "all",
		validFrom: "",
		validUntil: "",
		isActive: true,
		displayType: "spotlight",
	});

	// UI Config State - Service Launch by Geography
	const [uiConfig, setUiConfig] = useState<any[]>([]);
	const [selectedRole, setSelectedRole] = useState("veterinarian"); // Legacy - kept for backward compatibility
	const [availableRoles, setAvailableRoles] = useState<any[]>([]);
	const [configLoading, setConfigLoading] = useState(false);
	
	// New Geographic Selection State
	const [selectedState, setSelectedState] = useState<string>("");
	const [selectedCity, setSelectedCity] = useState<string>("");
	const [availableStates, setAvailableStates] = useState<{code: string; name: string}[]>([]);
	const [availableCities, setAvailableCities] = useState<string[]>([]);

	

	useEffect(() => {
		if (activeTab === "promotions") {
			loadPromotions();
			loadRoles();
		} else if (activeTab === "spotlight") {
			loadSpotlights();
			loadVendors();
		} else if (activeTab === "banners") {
			loadBanners();
		} else if (activeTab === "articles") {
			loadArticles();
		} else if (activeTab === "announcements") {
			loadAnnouncements();
		} else {
			loadRoles(); // Load roles first
		}
	}, [activeTab]);

	// Reload config when geography changes or tab is opened
	useEffect(() => {
		if (activeTab === "ui-config") {
			loadServiceLaunchConfig();
		}
	}, [selectedState, selectedCity, activeTab]);

	// Load cities when state changes
	useEffect(() => {
		if (selectedState) {
			loadCitiesForState(selectedState);
			setSelectedCity(""); // Reset city when state changes
		} else {
			setAvailableCities([]);
			setSelectedCity("");
		}
	}, [selectedState]);

	// Safety net: Ensure uiConfig is always an array
	useEffect(() => {
		if (!Array.isArray(uiConfig)) {
			console.error('[Safety Check] uiConfig is not an array! Fixing...', uiConfig, typeof uiConfig);
			setUiConfig([]);
		}
	}, [uiConfig]);

	const loadRoles = async () => {
		try {
			// Try /admin/roles first (preferred), fallback to /config/roles
			let data: any;
			try {
				data = await apiClient.get<any>("/admin/roles");
				if (data.success && data.roles) {
					// Ensure roles is an array
					const roles = Array.isArray(data.roles) ? data.roles : [];
					setAvailableRoles(roles);
					return;
				}
			} catch (err) {
				console.warn('Failed to load from /admin/roles, trying /config/roles:', err);
			}
			
			// Fallback to /config/roles
			data = await apiClient.get("/config/roles");
			// Ensure roles is an array
			const roles = Array.isArray((data as any).roles) ? (data as any).roles : [];
			setAvailableRoles(roles);

			// If current selected role is not in the list and we have roles, select the first one
			if (Array.isArray(roles) && roles.length > 0) {
				// Check if currently selected role exists in the fetched roles
				const roleExists = roles.some((r: any) => r.id === selectedRole);
				if (!roleExists) {
					setSelectedRole(roles[0].id);
				}
			}
		} catch (error) {
			console.error("Error loading roles:", error);
			setAvailableRoles([]); // Set to empty array on error
		}
	};

	// ===========================
	// SERVICE LAUNCH CONFIG (NEW GEOGRAPHY-BASED)
	// ===========================

	const loadServiceLaunchConfig = async () => {
		setConfigLoading(true);
		setUiConfig([]);
		try {
			// Build query params for geography
			const params = new URLSearchParams();
			if (selectedState) params.append('stateCode', selectedState);
			if (selectedCity) params.append('city', selectedCity);
			
			const data = await apiClient.get(`/config/service-launch?${params.toString()}`);
			
			console.log('[loadServiceLaunchConfig] Response:', data);
			
			if (data && typeof data === 'object' && (data as any).success) {
				const services = (data as any).services || [];
				// Store available states from response
				if ((data as any).availableStates) {
					setAvailableStates((data as any).availableStates);
				}
				setUiConfig(Array.isArray(services) ? services : []);
			} else {
				setUiConfig([]);
			}
		} catch (error) {
			console.error("Error loading service launch config:", error);
			toast.error("Failed to load service launch configuration");
			setUiConfig([]);
		} finally {
			setConfigLoading(false);
		}
	};

	const loadCitiesForState = async (stateCode: string) => {
		try {
			const data = await apiClient.get(`/config/service-launch/cities?stateCode=${stateCode}`);
			if (data && (data as any).success) {
				setAvailableCities((data as any).cities || []);
			} else {
				setAvailableCities([]);
			}
		} catch (error) {
			console.error("Error loading cities:", error);
			setAvailableCities([]);
		}
	};

	const handleUpdateServiceLaunch = async (serviceId: string, status: string, rolloutPercentage: number = 100) => {
		try {
			await apiClient.put("/config/service-launch/geography", {
				serviceId,
				stateCode: selectedState || undefined,
				city: selectedCity || undefined,
				status,
				rolloutPercentage,
			});
			toast.success(`Service "${serviceId}" updated to ${status}${selectedState ? ` for ${selectedState}` : ''}${selectedCity ? ` > ${selectedCity}` : ''}`);
			// Reload config to reflect changes
			loadServiceLaunchConfig();
		} catch (error) {
			console.error("Error updating service launch:", error);
			toast.error("Failed to update service launch status");
		}
	};

	const handleBulkSaveConfig = async () => {
		try {
			if (!Array.isArray(uiConfig)) {
				toast.error("Invalid configuration format");
				return;
			}
			
			// Build bulk update payload
			const services = uiConfig.map(svc => ({
				serviceId: svc.id || svc.serviceId,
				defaultStatus: svc.defaultStatus,
				defaultRolloutPercentage: svc.defaultRolloutPercentage,
				stateOverrides: svc.stateOverrides,
			}));
			
			await apiClient.put("/config/service-launch", { services });
			toast.success("Service launch configuration saved");
		} catch (error) {
			console.error("Error saving config:", error);
			toast.error("Failed to save configuration");
		}
	};

	// ===========================
	// SPOTLIGHT LOGIC
	// ===========================

	const loadSpotlights = async () => {
		setLoading(true);
		try {
			const data = await apiClient.get("/marketing/spotlights");
			// Ensure spotlights is an array
			const spotlights = Array.isArray((data as any).spotlights) 
				? (data as any).spotlights 
				: [];
			setSpotlights(spotlights);
		} catch (error) {
			console.error("Error loading spotlights:", error);
			setSpotlights([]); // Set to empty array on error
		} finally {
			setLoading(false);
		}
	};

	const loadVendors = async () => {
		try {
			// Fetch only active vendors
			const data = await apiClient.get("/admin/vendors");
			const vendors = Array.isArray((data as any).vendors) 
				? (data as any).vendors 
				: [];
			const activeVendors = vendors.filter(
				(v: any) => v.status === "approved"
			);
			setAvailableVendors(activeVendors);
		} catch (error) {
			console.error("Error loading vendors:", error);
			setAvailableVendors([]); // Set to empty array on error
		}
	};

	const handleAddSpotlight = async () => {
		if (!selectedVendorId) {
			toast.error("Please select a vendor");
			return;
		}

		try {
			const vendor = availableVendors.find(
				(v) => v.id === selectedVendorId || v.vendorId === selectedVendorId
			);

			const payload = {
				vendorId: selectedVendorId,
				vendorName:
					vendor?.businessName || vendor?.fullName || "Unknown Vendor",
				type: spotlightType,
				durationDays: parseInt(spotlightDuration),
				startDate: new Date().toISOString(),
				status: "active",
			};

			await apiClient.post("/marketing/spotlights", payload);
			toast.success("Vendor added to spotlight");
			setSpotlightModal(false);
			loadSpotlights();
			setSelectedVendorId("");
		} catch (error) {
			console.error("Error adding spotlight:", error);
			toast.error("Error adding spotlight");
		}
	};

	const handleRemoveSpotlight = async (id: string) => {
		if (!confirm("Remove this vendor from spotlight?")) return;

		try {
			await apiClient.delete(`/marketing/spotlights/${id}`);
			toast.success("Spotlight removed");
			loadSpotlights();
		} catch (error) {
			toast.error("Failed to remove spotlight");
		}
	};

	// ===========================
	// PROMOTIONS LOGIC
	// ===========================

	const loadPromotions = async () => {
		setLoading(true);
		try {
			const data = await apiClient.get("/marketing/promotions");
			if ((data as any).success) {
				// Ensure promotions is an array
				const promotions = Array.isArray((data as any).promotions) 
					? (data as any).promotions 
					: [];
				setPromotions(promotions);
			}
		} catch (error) {
			console.error("Error loading promotions:", error);
			toast.error("Failed to load promotions");
			setPromotions([]); // Set to empty array on error
		} finally {
			setLoading(false);
		}
	};

	const handleSavePromo = async () => {
		try {
			if (editingPromo) {
				await apiClient.put(`/marketing/promotions/${editingPromo.id}`, promoForm);
			} else {
				await apiClient.post("/marketing/promotions", promoForm);
			}
			toast.success(
				`Promotion ${editingPromo ? "updated" : "created"} successfully`
			);
			setShowPromoModal(false);
			loadPromotions();
			resetForm();
		} catch (error) {
			console.error("Error saving promotion:", error);
			toast.error("Error saving promotion");
		}
	};

	const handleDeletePromo = async (id: string) => {
		if (!confirm("Are you sure you want to delete this promotion?")) return;

		try {
			await apiClient.delete(`/marketing/promotions/${id}`);
			toast.success("Promotion deleted");
			loadPromotions();
		} catch (error) {
			toast.error("Failed to delete promotion");
		}
	};

	const resetForm = () => {
		setEditingPromo(null);
		setPromoForm({
			title: "",
			subtitle: "",
			discountType: "percentage",
			discountValue: 0,
			code: "",
			serviceCategory: "all",
			serviceStyle: "all",
			validFrom: "",
			validUntil: "",
			isActive: true,
			displayType: "spotlight",
		});
	};

	const openEditModal = (promo: any) => {
		setEditingPromo(promo);
		setPromoForm({
			title: promo.title,
			subtitle: promo.subtitle,
			discountType: promo.discountType,
			discountValue: promo.discountValue,
			code: promo.code,
			serviceCategory: promo.serviceCategory,
			serviceStyle: promo.serviceStyle,
			validFrom: promo.validFrom,
			validUntil: promo.validUntil,
			isActive: promo.isActive,
			displayType: promo.displayType,
		});
		setShowPromoModal(true);
	};

	// ===========================
	// BANNERS LOGIC
	// ===========================

	const loadBanners = async () => {
		setLoading(true);
		try {
			const data = await apiClient.get("/admin/banners");
			const bannersList = Array.isArray((data as any).banners) ? (data as any).banners : [];
			setBanners(bannersList);
		} catch (error) {
			console.error("Error loading banners:", error);
			setBanners([]);
		} finally {
			setLoading(false);
		}
	};

	const handleSaveBanner = async () => {
		try {
			if (editingBanner) {
				await apiClient.put(`/admin/banners/${editingBanner.id}`, {
					title: bannerForm.title,
					description: bannerForm.subtitle,
					imageUrl: bannerForm.image_url,
					linkUrl: bannerForm.cta_link,
					position: bannerForm.position,
					priority: bannerForm.display_order,
					startDate: bannerForm.start_date,
					endDate: bannerForm.end_date || null,
					isActive: bannerForm.is_active,
					ctaText: bannerForm.cta_text,
					metadata: { gradient_from: bannerForm.gradient_from, gradient_to: bannerForm.gradient_to },
				});
			} else {
				await apiClient.post("/admin/banners", {
					title: bannerForm.title,
					description: bannerForm.subtitle,
					imageUrl: bannerForm.image_url,
					linkUrl: bannerForm.cta_link,
					position: bannerForm.position,
					priority: bannerForm.display_order,
					startDate: bannerForm.start_date,
					endDate: bannerForm.end_date || null,
					isActive: bannerForm.is_active,
					ctaText: bannerForm.cta_text,
					metadata: { gradient_from: bannerForm.gradient_from, gradient_to: bannerForm.gradient_to },
				});
			}
			toast.success(`Banner ${editingBanner ? "updated" : "created"} successfully`);
			setShowBannerModal(false);
			loadBanners();
			resetBannerForm();
		} catch (error) {
			console.error("Error saving banner:", error);
			toast.error("Error saving banner");
		}
	};

	const handleDeleteBanner = async (id: string) => {
		if (!confirm("Are you sure you want to delete this banner?")) return;
		try {
			await apiClient.delete(`/admin/banners/${id}`);
			toast.success("Banner deleted");
			loadBanners();
		} catch (error) {
			toast.error("Failed to delete banner");
		}
	};

	const resetBannerForm = () => {
		setEditingBanner(null);
		setBannerForm({
			title: "",
			subtitle: "",
			image_url: "",
			cta_text: "Shop Now",
			cta_link: "",
			position: "home_top",
			is_active: true,
			start_date: new Date().toISOString().split("T")[0],
			end_date: "",
			display_order: banners.length,
			gradient_from: "#FF8C42",
			gradient_to: "#FF6B35",
		});
	};

	const openEditBannerModal = (banner: any) => {
		setEditingBanner(banner);
		setBannerForm({
			title: banner.title || "",
			subtitle: banner.subtitle || banner.description || "",
			image_url: banner.image_url || banner.imageUrl || "",
			cta_text: banner.cta_text || banner.ctaText || "Shop Now",
			cta_link: banner.cta_link || banner.linkUrl || "",
			position: banner.position || "home_top",
			is_active: banner.is_active !== false,
			start_date: banner.start_date ? new Date(banner.start_date).toISOString().split("T")[0] : "",
			end_date: banner.end_date ? new Date(banner.end_date).toISOString().split("T")[0] : "",
			display_order: banner.display_order || banner.priority || 0,
			gradient_from: banner.metadata?.gradient_from || "#FF8C42",
			gradient_to: banner.metadata?.gradient_to || "#FF6B35",
		});
		setShowBannerModal(true);
	};

	// ===========================
	// ARTICLES LOGIC
	// ===========================

	const loadArticles = async () => {
		setLoading(true);
		try {
			const data = await apiClient.get("/admin/content/pages");
			const allPages = Array.isArray((data as any).pages) ? (data as any).pages : [];
			// Filter for marketing articles
			const articlesList = allPages.filter((p: any) => p.category === 'marketing' || p.category === 'tips' || p.category === 'article');
			setArticles(articlesList);
		} catch (error) {
			console.error("Error loading articles:", error);
			setArticles([]);
		} finally {
			setLoading(false);
		}
	};

	const handleSaveArticle = async () => {
		try {
			const slug = articleForm.slug || articleForm.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
			if (editingArticle) {
				await apiClient.put(`/admin/content/pages/${editingArticle.pageId || editingArticle.id}`, {
					title: articleForm.title,
					slug: slug,
					content: articleForm.content,
					category: articleForm.category,
					isPublished: articleForm.is_published,
					metadata: { read_time: articleForm.read_time, featured: articleForm.featured },
				});
			} else {
				await apiClient.post("/admin/content/pages", {
					title: articleForm.title,
					slug: slug,
					content: articleForm.content,
					category: articleForm.category,
					isPublished: articleForm.is_published,
					metadata: { read_time: articleForm.read_time, featured: articleForm.featured },
				});
			}
			toast.success(`Article ${editingArticle ? "updated" : "created"} successfully`);
			setShowArticleModal(false);
			loadArticles();
			resetArticleForm();
		} catch (error) {
			console.error("Error saving article:", error);
			toast.error("Error saving article");
		}
	};

	const handleDeleteArticle = async (id: string) => {
		if (!confirm("Are you sure you want to delete this article?")) return;
		try {
			await apiClient.delete(`/admin/content/pages/${id}`);
			toast.success("Article deleted");
			loadArticles();
		} catch (error) {
			toast.error("Failed to delete article");
		}
	};

	const resetArticleForm = () => {
		setEditingArticle(null);
		setArticleForm({
			title: "",
			slug: "",
			content: "",
			category: "tips",
			read_time: "5 min",
			is_published: false,
			featured: false,
		});
	};

	const openEditArticleModal = (article: any) => {
		setEditingArticle(article);
		setArticleForm({
			title: article.title || "",
			slug: article.slug || "",
			content: article.content || "",
			category: article.category || "tips",
			read_time: article.metadata?.read_time || "5 min",
			is_published: article.isPublished || article.is_published || false,
			featured: article.metadata?.featured || false,
		});
		setShowArticleModal(true);
	};

	// ===========================
	// ANNOUNCEMENTS LOGIC (What's New)
	// ===========================

	const loadAnnouncements = async () => {
		setLoading(true);
		try {
			// Use platform_settings for announcements
			const data = await apiClient.get("/admin/platform-settings?key=home_announcements");
			if ((data as any).success && (data as any).setting?.setting_value) {
				const announcementList = Array.isArray((data as any).setting.setting_value) 
					? (data as any).setting.setting_value 
					: [];
				setAnnouncements(announcementList);
			} else {
				// Default announcements if none exist
				setAnnouncements([]);
			}
		} catch (error) {
			console.error("Error loading announcements:", error);
			setAnnouncements([]);
		} finally {
			setLoading(false);
		}
	};

	const handleSaveAnnouncement = async () => {
		try {
			const updatedAnnouncements = editingAnnouncement 
				? announcements.map((a) => a.id === editingAnnouncement.id ? { ...announcementForm, id: editingAnnouncement.id } : a)
				: [...announcements, { ...announcementForm, id: `ann_${Date.now()}` }];

			await apiClient.put("/admin/platform-settings", {
				settingKey: "home_announcements",
				settingValue: updatedAnnouncements,
				settingType: "array",
				description: "Customer home page announcements (What's New section)",
			});
			toast.success(`Announcement ${editingAnnouncement ? "updated" : "created"} successfully`);
			setShowAnnouncementModal(false);
			setAnnouncements(updatedAnnouncements);
			resetAnnouncementForm();
		} catch (error) {
			console.error("Error saving announcement:", error);
			toast.error("Error saving announcement");
		}
	};

	const handleDeleteAnnouncement = async (id: string) => {
		if (!confirm("Are you sure you want to delete this announcement?")) return;
		try {
			const updatedAnnouncements = announcements.filter((a) => a.id !== id);
			await apiClient.put("/admin/platform-settings", {
				settingKey: "home_announcements",
				settingValue: updatedAnnouncements,
				settingType: "array",
				description: "Customer home page announcements (What's New section)",
			});
			toast.success("Announcement deleted");
			setAnnouncements(updatedAnnouncements);
		} catch (error) {
			toast.error("Failed to delete announcement");
		}
	};

	const resetAnnouncementForm = () => {
		setEditingAnnouncement(null);
		setAnnouncementForm({
			title: "",
			subtitle: "",
			badge_text: "NEW",
			badge_color: "green",
			icon: "✨",
			cta_text: "",
			cta_link: "",
			is_active: true,
			display_order: announcements.length,
			announcement_type: "feature",
		});
	};

	const openEditAnnouncementModal = (announcement: any) => {
		setEditingAnnouncement(announcement);
		setAnnouncementForm({
			title: announcement.title || "",
			subtitle: announcement.subtitle || "",
			badge_text: announcement.badge_text || "NEW",
			badge_color: announcement.badge_color || "green",
			icon: announcement.icon || "✨",
			cta_text: announcement.cta_text || "",
			cta_link: announcement.cta_link || "",
			is_active: announcement.is_active !== false,
			display_order: announcement.display_order || 0,
			announcement_type: announcement.announcement_type || "feature",
		});
		setShowAnnouncementModal(true);
	};

	// ===========================
	// UI CONFIG LOGIC
	// ===========================

	const loadUiConfig = async () => {
		setConfigLoading(true);
		// Always initialize to empty array to prevent null/undefined issues
		setUiConfig([]);
		try {
			const data = await apiClient.get(`/config/ui/dashboard?roleId=${selectedRole}`);
			
			// Debug logging
			console.log('[loadUiConfig] Raw API response:', data);
			console.log('[loadUiConfig] Response type:', typeof data);
			console.log('[loadUiConfig] Is array:', Array.isArray(data));
			
			// Handle various response structures
			let config: any = null;
			
			// Case 1: Response has success and config properties
			if (data && typeof data === 'object' && 'success' in data && (data as any).success) {
				config = (data as any).config;
				console.log('[loadUiConfig] Extracted config from success response:', config);
			}
			// Case 2: Response is the config directly (array or object)
			else if (data && typeof data === 'object') {
				// Check if data itself is an array
				if (Array.isArray(data)) {
					console.log('[loadUiConfig] Data is array, using directly');
					setUiConfig(data);
					return;
				}
				// Check if data has config property (even without success)
				if ('config' in data) {
					config = (data as any).config;
					console.log('[loadUiConfig] Extracted config from data.config:', config);
				}
				// Otherwise, treat data as the config
				else {
					config = data;
					console.log('[loadUiConfig] Using data as config:', config);
				}
			}
			
			// Now process the config
			if (config === null || config === undefined) {
				console.log('[loadUiConfig] Config is null/undefined, setting empty array');
				setUiConfig([]);
				return;
			}
			
			// If config is an array, use it directly
			if (Array.isArray(config)) {
				console.log('[loadUiConfig] Config is array, using directly, length:', config.length);
				setUiConfig(config);
				return;
			}
			
			// If config is an object, try to extract buttons or widgets array
			if (config && typeof config === 'object') {
				if (Array.isArray(config.buttons)) {
					console.log('[loadUiConfig] Found config.buttons array, length:', config.buttons.length);
					setUiConfig(config.buttons);
					return;
				}
				if (Array.isArray(config.widgets)) {
					console.log('[loadUiConfig] Found config.widgets array, length:', config.widgets.length);
					setUiConfig(config.widgets);
					return;
				}
				console.log('[loadUiConfig] Config object but no buttons/widgets array found. Config keys:', Object.keys(config));
			}
			
			// Default to empty array if structure is unexpected
			console.warn('[loadUiConfig] Unexpected config structure, defaulting to empty array. Config:', config);
			setUiConfig([]);
		} catch (error) {
			console.error("Error loading config:", error);
			toast.error("Failed to load UI config");
			setUiConfig([]); // Set to empty array on error
		} finally {
			setConfigLoading(false);
		}
	};

	const handleToggleService = (index: number) => {
		if (!Array.isArray(uiConfig) || index < 0 || index >= uiConfig.length) return;
		const newConfig = [...uiConfig];
		if (newConfig[index]) {
			newConfig[index].enabled = !newConfig[index].enabled;
			setUiConfig(newConfig);
		}
	};

	const handleSaveConfig = async () => {
		try {
			if (!Array.isArray(uiConfig)) {
				toast.error("Invalid configuration format");
				return;
			}
			await apiClient.put("/config/ui/dashboard", {
				roleId: selectedRole,
				config: uiConfig,
			});
			toast.success("Dashboard configuration saved");
		} catch (error) {
			console.error("Error saving config:", error);
			toast.error("Error saving configuration");
		}
	};

	return (
		<AdminLayout>
			<div className="flex-1 flex flex-col min-h-screen bg-gray-50">
				<Toaster position="top-right" richColors />
				
				{/* Header - Match wireframe: border-b, max-w-7xl mx-auto px-6 py-4 */}
				<div className="bg-white border-b border-gray-200">
					<div className="max-w-7xl mx-auto px-6 py-4">
						<div className="flex items-center justify-between mb-4">
							<div>
								{/* ✅ FIX: Match wireframe - text-2xl font-bold for marketing page */}
								<h1 className="text-2xl font-bold text-gray-900">
									Marketing & Promotions
								</h1>
								<p className="text-gray-500 text-sm mt-1">
									Manage promotions and customize customer dashboard experience
								</p>
							</div>
							<div className="flex items-center gap-2">
								<div className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
									Live
								</div>
							</div>
						</div>

						{/* ✅ FIX: Improved tabs with thicker border and better visual hierarchy */}
						<div className="flex gap-0 overflow-x-auto border-b border-gray-200 -mb-px">
							<button
								onClick={() => setActiveTab("promotions")}
								className={`flex items-center gap-2 px-4 py-3 border-b-[3px] transition-colors whitespace-nowrap ${
									activeTab === "promotions"
										? "border-[#FF8C42] text-[#FF8C42] bg-orange-50/50"
										: "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50"
								}`}
							>
								<Megaphone className="w-4 h-4" />
								<span className="font-medium text-sm">Promotions</span>
							</button>
							<button
								onClick={() => setActiveTab("ui-config")}
								className={`flex items-center gap-2 px-4 py-3 border-b-[3px] transition-colors whitespace-nowrap ${
									activeTab === "ui-config"
										? "border-[#FF8C42] text-[#FF8C42] bg-orange-50/50"
										: "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50"
								}`}
							>
								<LayoutTemplate className="w-4 h-4" />
								<span className="font-medium text-sm">Dashboard UI</span>
							</button>
							<button
								onClick={() => setActiveTab("spotlight")}
								className={`flex items-center gap-2 px-4 py-3 border-b-[3px] transition-colors whitespace-nowrap ${
									activeTab === "spotlight"
										? "border-[#FF8C42] text-[#FF8C42] bg-orange-50/50"
										: "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50"
								}`}
							>
								<Star className="w-4 h-4" />
								<span className="font-medium text-sm">Spotlight</span>
							</button>
							<button
								onClick={() => setActiveTab("coupons")}
								className={`flex items-center gap-2 px-4 py-3 border-b-[3px] transition-colors whitespace-nowrap ${
									activeTab === "coupons"
										? "border-[#FF8C42] text-[#FF8C42] bg-orange-50/50"
										: "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50"
								}`}
							>
								<Tag className="w-4 h-4" />
								<span className="font-medium text-sm">Coupons</span>
							</button>
							<button
								onClick={() => setActiveTab("advanced")}
								className={`flex items-center gap-2 px-4 py-3 border-b-[3px] transition-colors whitespace-nowrap ${
									activeTab === "advanced"
										? "border-[#FF8C42] text-[#FF8C42] bg-orange-50/50"
										: "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50"
								}`}
							>
								<Zap className="w-4 h-4" />
								<span className="font-medium text-sm">Advanced</span>
							</button>
							<button
								onClick={() => setActiveTab("banners")}
								className={`flex items-center gap-2 px-4 py-3 border-b-[3px] transition-colors whitespace-nowrap ${
									activeTab === "banners"
										? "border-[#FF8C42] text-[#FF8C42] bg-orange-50/50"
										: "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50"
								}`}
							>
								<ImageIcon className="w-4 h-4" />
								<span className="font-medium text-sm">Banners</span>
							</button>
							<button
								onClick={() => setActiveTab("articles")}
								className={`flex items-center gap-2 px-4 py-3 border-b-[3px] transition-colors whitespace-nowrap ${
									activeTab === "articles"
										? "border-[#FF8C42] text-[#FF8C42] bg-orange-50/50"
										: "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50"
								}`}
							>
								<FileText className="w-4 h-4" />
								<span className="font-medium text-sm">Articles</span>
							</button>
							<button
								onClick={() => setActiveTab("announcements")}
								className={`flex items-center gap-2 px-4 py-3 border-b-[3px] transition-colors whitespace-nowrap ${
									activeTab === "announcements"
										? "border-[#FF8C42] text-[#FF8C42] bg-orange-50/50"
										: "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50"
								}`}
							>
								<Bell className="w-4 h-4" />
								<span className="font-medium text-sm">What's New</span>
							</button>
						</div>
					</div>
				</div>

				{/* Content - Match wireframe: max-w-7xl mx-auto p-6 */}
				<div className="flex-1 overflow-y-auto">
					<div className="max-w-7xl mx-auto p-6">
						{/* PROMOTIONS TAB */}
						{activeTab === "promotions" && (
							<Card className="p-6">
								<div className="flex justify-between items-center mb-6">
						<div className="relative w-64">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
							<Input placeholder="Search promotions..." className="pl-9" />
						</div>
						<Button
							className="bg-[#FF8C42] hover:bg-[#FF7A2E]"
							onClick={() => {
								resetForm();
								setShowPromoModal(true);
							}}
						>
							<Plus className="w-4 h-4 mr-2" />
							Create Promotion
						</Button>
					</div>

					{loading ? (
						<div className="text-center py-12">Loading promotions...</div>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Title</TableHead>
									<TableHead>Discount</TableHead>
									<TableHead>Code</TableHead>
									<TableHead>Category</TableHead>
									<TableHead>Status</TableHead>
									<TableHead className="text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{Array.isArray(promotions) && promotions.map((promo) => (
									<TableRow key={promo.id}>
										<TableCell className="font-medium">
											<div>{promo.title}</div>
											<div className="text-xs text-gray-500">
												{promo.subtitle}
											</div>
										</TableCell>
										<TableCell>
											<Badge
												variant="outline"
												className="bg-green-50 text-green-700 border-green-200"
											>
												{promo.discountType === "percentage"
													? `${promo.discountValue}%`
													: `₹${promo.discountValue}`}{" "}
												OFF
											</Badge>
										</TableCell>
										<TableCell className="font-mono text-xs">
											{promo.code}
										</TableCell>
										<TableCell className="capitalize">
											{(promo.serviceCategory ?? "").replace("_", " ")}
										</TableCell>
										<TableCell>
											<Switch
												checked={promo.isActive}
												onCheckedChange={async () => {
													// Toggle active status
													await apiClient.put(`/marketing/promotions/${promo.id}`, {
														isActive: !promo.isActive,
													});
													loadPromotions();
												}}
											/>
										</TableCell>
										<TableCell className="text-right">
											<Button
												variant="ghost"
												size="icon"
												onClick={() => openEditModal(promo)}
											>
												<Edit className="w-4 h-4 text-blue-600" />
											</Button>
											<Button
												variant="ghost"
												size="icon"
												onClick={() => handleDeletePromo(promo.id)}
											>
												<Trash2 className="w-4 h-4 text-red-600" />
											</Button>
										</TableCell>
									</TableRow>
								))}
								{(!Array.isArray(promotions) || promotions.length === 0) && (
									<TableRow>
										<TableCell
											colSpan={6}
											className="text-center py-8 text-gray-500"
										>
											No promotions found. Create one to get started.
										</TableCell>
									</TableRow>
										)}
									</TableBody>
								</Table>
							)}
						</Card>
						)}

						{/* UI CONFIG TAB - Service Launch by Geography */}
						{activeTab === "ui-config" && (
							<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
								{/* Geographic Scope Selection */}
								<Card className="p-6 col-span-1 h-fit relative overflow-visible">
									<h3 className="font-semibold mb-4">Geographic Scope</h3>
									<div className="space-y-4">
										{/* State Selector */}
										<div className="relative z-30">
											<Label className="block text-sm font-medium text-gray-700 mb-2">State</Label>
											<Select value={selectedState || "__all__"} onValueChange={(val: string) => setSelectedState(val === "__all__" ? "" : val)}>
												<SelectTrigger className="w-full">
													<SelectValue placeholder="All India (Default)" />
												</SelectTrigger>
												<SelectContent className="max-h-[280px] overflow-y-auto z-50">
													<SelectItem value="__all__">All India (Default)</SelectItem>
													{availableStates.map((state) => (
														<SelectItem key={state.code} value={state.code}>
															{state.name}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>
										
										{/* City Selector - Only show when state is selected */}
										{selectedState && (
											<div className="relative z-20">
												<Label className="block text-sm font-medium text-gray-700 mb-2">City</Label>
												<Select value={selectedCity || "__all__"} onValueChange={(val: string) => setSelectedCity(val === "__all__" ? "" : val)}>
													<SelectTrigger className="w-full">
														<SelectValue placeholder="All Cities in State" />
													</SelectTrigger>
													<SelectContent className="max-h-[280px] overflow-y-auto z-50">
														<SelectItem value="__all__">All Cities in State</SelectItem>
														{availableCities.map((city) => (
															<SelectItem key={city} value={city}>
																{city}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
											</div>
										)}
										
										{/* Current Scope Indicator */}
										<div className="pt-4 border-t">
											<div className="text-sm font-medium text-gray-700 mb-2">Editing Launch Status For:</div>
											<div className="bg-blue-50 text-blue-700 px-3 py-2 rounded-lg text-sm font-medium">
												{selectedCity ? `${selectedCity}, ${selectedState}` : 
												 selectedState ? `All of ${availableStates.find(s => s.code === selectedState)?.name || selectedState}` : 
												 'All India (Default)'}
											</div>
										</div>
										
										<div className="pt-4 border-t text-sm text-gray-500">
											<p className="mb-2"><strong>How it works:</strong></p>
											<ul className="list-disc list-inside space-y-1 text-xs">
												<li><strong>Hidden</strong> - Service not visible to customers</li>
												<li><strong>Coming Soon</strong> - Visible but not bookable</li>
												<li><strong>Beta</strong> - Available to beta users only</li>
												<li><strong>Launched</strong> - Fully available to all</li>
											</ul>
											<p className="mt-3 text-xs">
												City overrides State settings. State overrides Default.
											</p>
										</div>
									</div>
								</Card>

								{/* Services Launch Status */}
								<Card className="p-6 col-span-2">
									<div className="flex justify-between items-center mb-6">
										<div>
											<h3 className="font-semibold">Service Launch Status</h3>
											<p className="text-sm text-gray-500">
												Control service visibility and booking availability by geography
											</p>
										</div>
										<Button
											onClick={handleBulkSaveConfig}
											disabled={configLoading}
											className="bg-[#FF8C42] hover:bg-[#FF7A2E]"
										>
											<Save className="w-4 h-4 mr-2" />
											Save All Changes
										</Button>
									</div>

									{configLoading ? (
										<div className="text-center py-12">Loading services from catalog...</div>
									) : (
										<div className="space-y-4">
											{(() => {
												if (!Array.isArray(uiConfig)) {
													console.error('[UI Config Render] uiConfig is not an array!', uiConfig, typeof uiConfig);
													return null;
												}
												if (uiConfig.length === 0) {
													return (
														<div className="text-center py-8 text-gray-500">
															No services found in catalog. Add services in Catalog &amp; Services first.
														</div>
													);
												}
												return uiConfig.map((svc: any) => (
													<div
														key={svc.id || svc.serviceId}
														className="p-4 border rounded-lg bg-gray-50 space-y-3"
													>
														<div className="flex items-center justify-between">
															<div className="flex items-center gap-3">
																<div className="w-10 h-10 bg-white rounded-lg border flex items-center justify-center text-xl">
																	{svc.icon || "🔘"}
																</div>
																<div className="flex-1">
																	<div className="font-medium">{svc.displayName || svc.serviceName || svc.id}</div>
																	<div className="text-xs text-gray-500">
																		Category: {svc.categoryName || svc.categoryId || 'N/A'}
																	</div>
																</div>
															</div>
															{/* Status Badge */}
															<div className="flex items-center gap-2">
																{svc.effectiveStatus === 'launched' && (
																	<Badge className="bg-green-100 text-green-700">Launched</Badge>
																)}
																{svc.effectiveStatus === 'beta' && (
																	<Badge className="bg-blue-100 text-blue-700">Beta</Badge>
																)}
																{svc.effectiveStatus === 'coming_soon' && (
																	<Badge className="bg-amber-100 text-amber-700">Coming Soon</Badge>
																)}
																{svc.effectiveStatus === 'hidden' && (
																	<Badge className="bg-gray-100 text-gray-500">Hidden</Badge>
																)}
															</div>
														</div>
														
														{/* Launch Status Controls */}
														<div className="pt-2 border-t space-y-2">
															<div className="grid grid-cols-2 gap-4 text-xs">
																<div>
																	<span className="text-gray-500 block mb-1">
																		Launch Status {selectedState ? `(${selectedState}${selectedCity ? ` > ${selectedCity}` : ''})` : '(Default)'}:
																	</span>
																	<Select
																		value={svc.effectiveStatus || "hidden"}
																		onValueChange={(value: string) => handleUpdateServiceLaunch(svc.id || svc.serviceId, value, svc.effectiveRolloutPercentage || 100)}
																	>
																		<SelectTrigger className="h-8 text-xs">
																			<SelectValue />
																		</SelectTrigger>
																		<SelectContent>
																			<SelectItem value="hidden">
																				<span className="flex items-center gap-2">
																					<EyeOff className="w-3 h-3" /> Hidden
																				</span>
																			</SelectItem>
																			<SelectItem value="coming_soon">
																				<span className="flex items-center gap-2">
																					<Calendar className="w-3 h-3" /> Coming Soon
																				</span>
																			</SelectItem>
																			<SelectItem value="beta">
																				<span className="flex items-center gap-2">
																					<Star className="w-3 h-3" /> Beta
																				</span>
																			</SelectItem>
																			<SelectItem value="launched">
																				<span className="flex items-center gap-2">
																					<Eye className="w-3 h-3" /> Launched
																				</span>
																			</SelectItem>
																		</SelectContent>
																	</Select>
																</div>
																<div>
																	<span className="text-gray-500 block mb-1">Rollout %:</span>
																	<Input
																		type="number"
																		min="0"
																		max="100"
																		value={svc.effectiveRolloutPercentage || 100}
																		onChange={(e) => {
																			const percentage = parseInt(e.target.value) || 100;
																			handleUpdateServiceLaunch(svc.id || svc.serviceId, svc.effectiveStatus || 'hidden', percentage);
																		}}
																		className="h-8 text-xs"
																		placeholder="100"
																	/>
																</div>
															</div>
															
															{/* Info Messages */}
															{svc.effectiveStatus === "coming_soon" && (
																<div className="text-xs text-amber-600 bg-amber-50 p-2 rounded flex items-center gap-2">
																	<Calendar className="w-3 h-3" />
																	Service visible as &quot;Coming Soon&quot; - not bookable
																</div>
															)}
															{svc.effectiveStatus === "beta" && (
																<div className="text-xs text-blue-600 bg-blue-50 p-2 rounded flex items-center gap-2">
																	<Star className="w-3 h-3" />
																	Service available for beta users only
																</div>
															)}
															{svc.effectiveStatus === "launched" && (
																<div className="text-xs text-green-600 bg-green-50 p-2 rounded flex items-center gap-2">
																	<Eye className="w-3 h-3" />
																	Service fully available for booking
																</div>
															)}
															
															{/* Show Default/Override Indicator */}
															{(selectedState || selectedCity) && svc.defaultStatus && (
																<div className="text-xs text-gray-500 mt-2">
																	Default status: <span className="font-medium capitalize">{svc.defaultStatus}</span>
																</div>
															)}
														</div>
													</div>
												));
											})()}
											{(() => {
												// Error state handler
												if (!Array.isArray(uiConfig)) {
													console.error('[UI Config Empty State] uiConfig is not an array!', uiConfig, typeof uiConfig);
													return (
														<div className="text-center py-8 text-gray-500">
															Configuration error. Please refresh the page.
															<Button
																variant="outline"
																onClick={loadServiceLaunchConfig}
																className="mt-2 ml-2"
															>
																<RotateCcw className="w-4 h-4 mr-2" /> Retry
															</Button>
														</div>
													);
												}
												// Empty state is handled above in the mapping
												return null;
											})()}
										</div>
									)}
								</Card>
							</div>
						)}

						{/* SPOTLIGHT TAB */}
						{activeTab === "spotlight" && (
							<div className="space-y-6">
								<div className="flex justify-between items-center">
									<div>
										<h3 className="text-lg font-medium">Featured Vendors</h3>
										<p className="text-sm text-gray-500">
											Highlight top performing vendors on the home screen
										</p>
									</div>
									<Button
										className="bg-[#FF8C42] hover:bg-[#FF7A2E]"
										onClick={() => setSpotlightModal(true)}
									>
										<Plus className="w-4 h-4 mr-2" />
										Add Spotlight
									</Button>
								</div>

											<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
									{Array.isArray(spotlights) && spotlights.map((spot) => (
										<Card
											key={spot.id}
											className="overflow-hidden border-orange-100 shadow-sm hover:shadow-md transition-all"
										>
											<div className="bg-gradient-to-r from-orange-50 to-white p-4 border-b border-orange-100 flex justify-between items-start">
												<div className="flex items-center gap-2">
													<div className="p-2 bg-white rounded-full shadow-sm">
														<Zap className="w-4 h-4 text-orange-500 fill-orange-500" />
													</div>
													<span className="text-xs font-semibold text-orange-600 uppercase tracking-wider">
														Featured
													</span>
												</div>
												<Button
													variant="ghost"
													size="icon"
													className="h-6 w-6 -mr-2 hover:text-red-600"
													onClick={() => handleRemoveSpotlight(spot.id)}
												>
													<Trash2 className="w-3 h-3" />
												</Button>
											</div>
											<div className="p-4">
												<h4 className="font-bold text-lg mb-1">{spot.vendorName}</h4>
												<div className="flex items-center gap-2 mb-3">
													<Badge variant="secondary" className="text-xs">
														{spot.type === "featured_vendor"
															? "Vendor Spotlight"
															: "Service Highlight"}
													</Badge>
												</div>
												<div className="text-sm text-gray-500 flex justify-between items-center pt-2 border-t mt-2">
													<span>Expires in:</span>
													<span className="font-medium text-gray-900">
														{Math.max(
															0,
															Math.ceil(
																(new Date(
																	new Date(spot.startDate).getTime() +
																		spot.durationDays * 86400000
																).getTime() -
																	new Date().getTime()) /
																	(1000 * 3600 * 24)
															)
														)}{" "}
														days
													</span>
												</div>
											</div>
										</Card>
									))}

									{(!Array.isArray(spotlights) || spotlights.length === 0) && (
										<div className="col-span-3 text-center py-12 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
											<Star className="w-12 h-12 text-gray-300 mx-auto mb-3" />
											<h3 className="text-gray-900 font-medium">
												No Active Spotlights
											</h3>
											<p className="text-gray-500 text-sm mt-1 mb-4">
												Feature your best vendors to boost their visibility
											</p>
											<Button
												variant="outline"
												onClick={() => setSpotlightModal(true)}
											>
												Add First Spotlight
											</Button>
										</div>
									)}
								</div>
							</div>
						)}

						{/* COUPONS TAB */}
						{activeTab === "coupons" && <CouponManagement />}

						{/* ADVANCED TAB */}
						{activeTab === "advanced" && <AdvancedPromotionsEngine />}

						{/* BANNERS TAB */}
						{activeTab === "banners" && (
							<div className="space-y-6">
								<div className="flex justify-between items-center">
									<div>
										<h3 className="text-lg font-medium">Home Banners</h3>
										<p className="text-sm text-gray-500">
											Manage promotional banners displayed on customer home screen
										</p>
									</div>
									<Button
										className="bg-[#FF8C42] hover:bg-[#FF7A2E]"
										onClick={() => {
											resetBannerForm();
											setShowBannerModal(true);
										}}
									>
										<Plus className="w-4 h-4 mr-2" />
										Create Banner
									</Button>
								</div>

								{loading ? (
									<div className="text-center py-12">Loading banners...</div>
								) : (
									<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
										{banners.map((banner) => (
											<Card key={banner.id} className="overflow-hidden">
												<div 
													className="h-32 flex items-center justify-center relative"
													style={{
														background: banner.image_url || banner.imageUrl 
															? `url(${banner.image_url || banner.imageUrl}) center/cover` 
															: `linear-gradient(135deg, ${banner.metadata?.gradient_from || '#FF8C42'} 0%, ${banner.metadata?.gradient_to || '#FF6B35'} 100%)`
													}}
												>
													{!banner.image_url && !banner.imageUrl && (
														<ImageIcon className="w-12 h-12 text-white/50" />
													)}
													<Badge 
														className={`absolute top-2 right-2 ${banner.is_active ? 'bg-green-500' : 'bg-gray-500'}`}
													>
														{banner.is_active ? 'Active' : 'Inactive'}
													</Badge>
													<Badge className="absolute top-2 left-2 bg-blue-500">
														{banner.position?.replace('_', ' ') || 'home_top'}
													</Badge>
												</div>
												<div className="p-4">
													<h4 className="font-semibold text-gray-900">{banner.title}</h4>
													<p className="text-sm text-gray-500 line-clamp-1">
														{banner.subtitle || banner.description || 'No subtitle'}
													</p>
													<div className="flex items-center justify-between mt-3">
														<div className="text-xs text-gray-400">
															Order: {banner.display_order || banner.priority || 0}
														</div>
														<div className="flex gap-1">
															<Button
																variant="ghost"
																size="icon"
																onClick={() => openEditBannerModal(banner)}
															>
																<Edit className="w-4 h-4 text-blue-600" />
															</Button>
															<Button
																variant="ghost"
																size="icon"
																onClick={() => handleDeleteBanner(banner.id)}
															>
																<Trash2 className="w-4 h-4 text-red-600" />
															</Button>
														</div>
													</div>
												</div>
											</Card>
										))}

										{banners.length === 0 && (
											<div className="col-span-3 text-center py-12 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
												<ImageIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
												<h3 className="text-gray-900 font-medium">No Banners Yet</h3>
												<p className="text-gray-500 text-sm mt-1 mb-4">
													Create eye-catching banners for customer home screen
												</p>
												<Button
													variant="outline"
													onClick={() => {
														resetBannerForm();
														setShowBannerModal(true);
													}}
												>
													Create First Banner
												</Button>
											</div>
										)}
									</div>
								)}
							</div>
						)}

						{/* ARTICLES TAB */}
						{activeTab === "articles" && (
							<div className="space-y-6">
								<div className="flex justify-between items-center">
									<div>
										<h3 className="text-lg font-medium">Pet Care Articles</h3>
										<p className="text-sm text-gray-500">
											Manage educational articles displayed on customer home
										</p>
									</div>
									<Button
										className="bg-[#FF8C42] hover:bg-[#FF7A2E]"
										onClick={() => {
											resetArticleForm();
											setShowArticleModal(true);
										}}
									>
										<Plus className="w-4 h-4 mr-2" />
										Create Article
									</Button>
								</div>

								{loading ? (
									<div className="text-center py-12">Loading articles...</div>
								) : (
									<Card className="overflow-hidden">
										<Table>
											<TableHeader>
												<TableRow>
													<TableHead>Title</TableHead>
													<TableHead>Category</TableHead>
													<TableHead>Read Time</TableHead>
													<TableHead>Status</TableHead>
													<TableHead>Featured</TableHead>
													<TableHead className="text-right">Actions</TableHead>
												</TableRow>
											</TableHeader>
											<TableBody>
												{articles.map((article) => (
													<TableRow key={article.pageId || article.id}>
														<TableCell className="font-medium">
															<div>{article.title}</div>
															<div className="text-xs text-gray-500 font-mono">/{article.slug}</div>
														</TableCell>
														<TableCell>
															<Badge variant="outline" className="capitalize">
																{article.category}
															</Badge>
														</TableCell>
														<TableCell>{article.metadata?.read_time || '5 min'}</TableCell>
														<TableCell>
															{article.isPublished || article.is_published ? (
																<Badge className="bg-green-100 text-green-700">Published</Badge>
															) : (
																<Badge className="bg-gray-100 text-gray-700">Draft</Badge>
															)}
														</TableCell>
														<TableCell>
															{article.metadata?.featured ? (
																<Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
															) : (
																<Star className="w-4 h-4 text-gray-300" />
															)}
														</TableCell>
														<TableCell className="text-right">
															<Button
																variant="ghost"
																size="icon"
																onClick={() => openEditArticleModal(article)}
															>
																<Edit className="w-4 h-4 text-blue-600" />
															</Button>
															<Button
																variant="ghost"
																size="icon"
																onClick={() => handleDeleteArticle(article.pageId || article.id)}
															>
																<Trash2 className="w-4 h-4 text-red-600" />
															</Button>
														</TableCell>
													</TableRow>
												))}
												{articles.length === 0 && (
													<TableRow>
														<TableCell colSpan={6} className="text-center py-8 text-gray-500">
															No articles found. Create educational content for pet owners.
														</TableCell>
													</TableRow>
												)}
											</TableBody>
										</Table>
									</Card>
								)}
							</div>
						)}

						{/* ANNOUNCEMENTS TAB (What's New) */}
						{activeTab === "announcements" && (
							<div className="space-y-6">
								<div className="flex justify-between items-center">
									<div>
										<h3 className="text-lg font-medium">What's New Announcements</h3>
										<p className="text-sm text-gray-500">
											Manage announcements for the "What's New" section on customer home
										</p>
									</div>
									<Button
										className="bg-[#FF8C42] hover:bg-[#FF7A2E]"
										onClick={() => {
											resetAnnouncementForm();
											setShowAnnouncementModal(true);
										}}
									>
										<Plus className="w-4 h-4 mr-2" />
										Add Announcement
									</Button>
								</div>

								{loading ? (
									<div className="text-center py-12">Loading announcements...</div>
								) : (
									<div className="space-y-4">
										{announcements.map((announcement) => (
											<Card key={announcement.id} className="p-4">
												<div className="flex items-start gap-4">
													<div 
														className={`w-14 h-14 rounded-xl flex items-center justify-center text-2xl shrink-0 ${
															announcement.announcement_type === 'emergency' ? 'bg-red-100' :
															announcement.announcement_type === 'premium' ? 'bg-purple-100' :
															'bg-orange-100'
														}`}
													>
														{announcement.icon || '✨'}
													</div>
													<div className="flex-1">
														<div className="flex items-center gap-2 mb-1">
															<Badge 
																className={`text-xs ${
																	announcement.badge_color === 'red' ? 'bg-red-500' :
																	announcement.badge_color === 'purple' ? 'bg-purple-500' :
																	announcement.badge_color === 'blue' ? 'bg-blue-500' :
																	'bg-green-500'
																} text-white`}
															>
																{announcement.badge_text || 'NEW'}
															</Badge>
															{!announcement.is_active && (
																<Badge variant="outline" className="text-gray-500">Inactive</Badge>
															)}
														</div>
														<h4 className="font-semibold text-gray-900">{announcement.title}</h4>
														<p className="text-sm text-gray-500">{announcement.subtitle}</p>
														{announcement.cta_text && (
															<div className="flex items-center gap-1 mt-2 text-sm text-[#FF8C42]">
																<LinkIcon className="w-3 h-3" />
																{announcement.cta_text}
															</div>
														)}
													</div>
													<div className="flex gap-1">
														<Button
															variant="ghost"
															size="icon"
															onClick={() => openEditAnnouncementModal(announcement)}
														>
															<Edit className="w-4 h-4 text-blue-600" />
														</Button>
														<Button
															variant="ghost"
															size="icon"
															onClick={() => handleDeleteAnnouncement(announcement.id)}
														>
															<Trash2 className="w-4 h-4 text-red-600" />
														</Button>
													</div>
												</div>
											</Card>
										))}

										{announcements.length === 0 && (
											<div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
												<Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
												<h3 className="text-gray-900 font-medium">No Announcements</h3>
												<p className="text-gray-500 text-sm mt-1 mb-4">
													Add announcements for the "What's New" section
												</p>
												<Button
													variant="outline"
													onClick={() => {
														resetAnnouncementForm();
														setShowAnnouncementModal(true);
													}}
												>
													Add First Announcement
												</Button>
											</div>
										)}
									</div>
								)}
							</div>
						)}
					</div>
				</div>
			</div>

			{/* CREATE/EDIT PROMO MODAL */}
			<Dialog open={showPromoModal} onOpenChange={setShowPromoModal}>
				<DialogContent className="max-w-lg">
					<DialogHeader>
						<DialogTitle>
							{editingPromo ? "Edit Promotion" : "Create New Promotion"}
						</DialogTitle>
						<DialogDescription>
							Configure details for the marketing campaign.
						</DialogDescription>
					</DialogHeader>

					<div className="grid gap-4 py-4">
						<div className="grid grid-cols-2 gap-4">
							<div>
								<Label>Title</Label>
								<Input
									value={promoForm.title}
									onChange={(e) =>
										setPromoForm({ ...promoForm, title: e.target.value })
									}
									placeholder="e.g. Summer Sale"
								/>
							</div>
							<div>
								<Label>Subtitle</Label>
								<Input
									value={promoForm.subtitle}
									onChange={(e) =>
										setPromoForm({ ...promoForm, subtitle: e.target.value })
									}
									placeholder="e.g. 20% off on grooming"
								/>
							</div>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div>
								<Label>Discount Type</Label>
								<Select
									value={promoForm.discountType}
									onValueChange={(v: string) =>
										setPromoForm({ ...promoForm, discountType: v })
									}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="percentage">Percentage (%)</SelectItem>
										<SelectItem value="flat">Flat Amount (₹)</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div>
								<Label>Discount Value</Label>
								<Input
									type="number"
									value={promoForm.discountValue}
									onChange={(e) =>
										setPromoForm({
											...promoForm,
											discountValue: parseFloat(e.target.value) || 0,
										})
									}
									placeholder="0"
								/>
							</div>
						</div>

						<div>
							<Label>Promo Code</Label>
							<Input
								value={promoForm.code}
								onChange={(e) =>
									setPromoForm({ ...promoForm, code: e.target.value.toUpperCase() })
								}
								placeholder="SUMMER2024"
							/>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div>
								<Label>Category</Label>
								<Select
									value={promoForm.serviceCategory}
									onValueChange={(v: string) =>
										setPromoForm({ ...promoForm, serviceCategory: v })
									}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">All Categories</SelectItem>
										<SelectItem value="vet">Veterinary</SelectItem>
										<SelectItem value="grooming">Grooming</SelectItem>
										<SelectItem value="walking">Walking</SelectItem>
										<SelectItem value="training">Training</SelectItem>
										<SelectItem value="boarding">Boarding</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div>
								<Label>Service Style</Label>
								<Select
									value={promoForm.serviceStyle}
									onValueChange={(v: string) =>
										setPromoForm({ ...promoForm, serviceStyle: v })
									}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">All Styles</SelectItem>
										<SelectItem value="home_visit">Home Visit</SelectItem>
										<SelectItem value="clinic">Clinic</SelectItem>
										<SelectItem value="online">Online</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div>
								<Label>Valid From</Label>
								<Input
									type="datetime-local"
									value={promoForm.validFrom}
									onChange={(e) =>
										setPromoForm({ ...promoForm, validFrom: e.target.value })
									}
								/>
							</div>
							<div>
								<Label>Valid Until</Label>
								<Input
									type="datetime-local"
									value={promoForm.validUntil}
									onChange={(e) =>
										setPromoForm({ ...promoForm, validUntil: e.target.value })
									}
								/>
							</div>
						</div>

						<div className="flex items-center gap-2">
							<Switch
								checked={promoForm.isActive}
								onCheckedChange={(checked: boolean) =>
									setPromoForm({ ...promoForm, isActive: checked })
								}
							/>
							<Label>Active</Label>
						</div>
					</div>

					<DialogFooter>
						<Button variant="outline" onClick={() => setShowPromoModal(false)}>
							Cancel
						</Button>
						<Button
							onClick={handleSavePromo}
							className="bg-[#FF8C42] hover:bg-[#FF7A2E]"
						>
							Save Promotion
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* SPOTLIGHT MODAL */}
			<Dialog open={spotlightModal} onOpenChange={setSpotlightModal}>
				<DialogContent className="max-w-md">
					<DialogHeader>
						<DialogTitle>Add Spotlight</DialogTitle>
						<DialogDescription>
							Feature a vendor or service on the homepage.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4 py-4">
						<div className="space-y-2">
							<Label>Select Vendor</Label>
							<Select
								value={selectedVendorId}
								onValueChange={setSelectedVendorId}
							>
								<SelectTrigger>
									<SelectValue placeholder="Search vendors..." />
								</SelectTrigger>
								<SelectContent className="max-h-60">
									{Array.isArray(availableVendors) && availableVendors.map((v) => (
										<SelectItem
											key={v.id || v.vendorId}
											value={v.id || v.vendorId}
										>
											{v.businessName || v.fullName} ({v.vendorType})
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div className="space-y-2">
							<Label>Spotlight Type</Label>
							<Select value={spotlightType} onValueChange={setSpotlightType}>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="featured_vendor">Featured Vendor</SelectItem>
									<SelectItem value="service_highlight">Service Highlight</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<div className="space-y-2">
							<Label>Duration (Days)</Label>
							<Select
								value={spotlightDuration}
								onValueChange={setSpotlightDuration}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="3">3 Days</SelectItem>
									<SelectItem value="7">7 Days</SelectItem>
									<SelectItem value="14">14 Days</SelectItem>
									<SelectItem value="30">30 Days</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>

					<DialogFooter>
						<Button variant="outline" onClick={() => setSpotlightModal(false)}>
							Cancel
						</Button>
						<Button
							onClick={handleAddSpotlight}
							className="bg-[#FF8C42] hover:bg-[#FF7A2E]"
						>
							Add Spotlight
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* BANNER MODAL */}
			<Dialog open={showBannerModal} onOpenChange={setShowBannerModal}>
				<DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>
							{editingBanner ? "Edit Banner" : "Create New Banner"}
						</DialogTitle>
						<DialogDescription>
							Configure promotional banner for customer home screen
						</DialogDescription>
					</DialogHeader>

					<div className="grid gap-4 py-4">
						<div className="grid grid-cols-2 gap-4">
							<div>
								<Label>Title *</Label>
								<Input
									value={bannerForm.title}
									onChange={(e) => setBannerForm({ ...bannerForm, title: e.target.value })}
									placeholder="e.g. Get 50% OFF"
								/>
							</div>
							<div>
								<Label>Subtitle</Label>
								<Input
									value={bannerForm.subtitle}
									onChange={(e) => setBannerForm({ ...bannerForm, subtitle: e.target.value })}
									placeholder="e.g. First Grooming Session"
								/>
							</div>
						</div>

						<div>
							<Label>Image URL (optional)</Label>
							<Input
								value={bannerForm.image_url}
								onChange={(e) => setBannerForm({ ...bannerForm, image_url: e.target.value })}
								placeholder="https://example.com/banner.jpg"
							/>
							<p className="text-xs text-gray-500 mt-1">Leave empty to use gradient colors</p>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div>
								<Label>Gradient From</Label>
								<div className="flex gap-2">
									<Input
										type="color"
										value={bannerForm.gradient_from}
										onChange={(e) => setBannerForm({ ...bannerForm, gradient_from: e.target.value })}
										className="w-12 h-10 p-1"
									/>
									<Input
										value={bannerForm.gradient_from}
										onChange={(e) => setBannerForm({ ...bannerForm, gradient_from: e.target.value })}
										placeholder="#FF8C42"
									/>
								</div>
							</div>
							<div>
								<Label>Gradient To</Label>
								<div className="flex gap-2">
									<Input
										type="color"
										value={bannerForm.gradient_to}
										onChange={(e) => setBannerForm({ ...bannerForm, gradient_to: e.target.value })}
										className="w-12 h-10 p-1"
									/>
									<Input
										value={bannerForm.gradient_to}
										onChange={(e) => setBannerForm({ ...bannerForm, gradient_to: e.target.value })}
										placeholder="#FF6B35"
									/>
								</div>
							</div>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div>
								<Label>CTA Button Text</Label>
								<Input
									value={bannerForm.cta_text}
									onChange={(e) => setBannerForm({ ...bannerForm, cta_text: e.target.value })}
									placeholder="Claim Now"
								/>
							</div>
							<div>
								<Label>CTA Link</Label>
								<Input
									value={bannerForm.cta_link}
									onChange={(e) => setBannerForm({ ...bannerForm, cta_link: e.target.value })}
									placeholder="/grooming"
								/>
							</div>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div>
								<Label>Position</Label>
								<Select
									value={bannerForm.position}
									onValueChange={(v: string) => setBannerForm({ ...bannerForm, position: v })}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="home_top">Home Top (Hero Carousel)</SelectItem>
										<SelectItem value="home_middle">Home Middle</SelectItem>
										<SelectItem value="category">Category Page</SelectItem>
										<SelectItem value="checkout">Checkout Page</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div>
								<Label>Display Order</Label>
								<Input
									type="number"
									value={bannerForm.display_order}
									onChange={(e) => setBannerForm({ ...bannerForm, display_order: parseInt(e.target.value) || 0 })}
									min="0"
								/>
							</div>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div>
								<Label>Start Date</Label>
								<Input
									type="date"
									value={bannerForm.start_date}
									onChange={(e) => setBannerForm({ ...bannerForm, start_date: e.target.value })}
								/>
							</div>
							<div>
								<Label>End Date (optional)</Label>
								<Input
									type="date"
									value={bannerForm.end_date}
									onChange={(e) => setBannerForm({ ...bannerForm, end_date: e.target.value })}
								/>
							</div>
						</div>

						<div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
							<Switch
								checked={bannerForm.is_active}
								onCheckedChange={(checked: boolean) => setBannerForm({ ...bannerForm, is_active: checked })}
							/>
							<Label>Banner is active</Label>
						</div>

						{/* Preview */}
						<div>
							<Label className="mb-2 block">Preview</Label>
							<div 
								className="h-24 rounded-xl overflow-hidden flex items-center justify-between px-4"
								style={{
									background: bannerForm.image_url 
										? `url(${bannerForm.image_url}) center/cover` 
										: `linear-gradient(135deg, ${bannerForm.gradient_from} 0%, ${bannerForm.gradient_to} 100%)`
								}}
							>
								<div>
									<h3 className="text-white font-bold">{bannerForm.title || 'Banner Title'}</h3>
									<p className="text-white/90 text-sm">{bannerForm.subtitle || 'Subtitle here'}</p>
									{bannerForm.cta_text && (
										<span className="inline-block mt-1 bg-white text-gray-900 px-3 py-1 rounded-full text-xs font-medium">
											{bannerForm.cta_text}
										</span>
									)}
								</div>
							</div>
						</div>
					</div>

					<DialogFooter>
						<Button variant="outline" onClick={() => setShowBannerModal(false)}>
							Cancel
						</Button>
						<Button onClick={handleSaveBanner} className="bg-[#FF8C42] hover:bg-[#FF7A2E]">
							{editingBanner ? 'Update' : 'Create'} Banner
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* ARTICLE MODAL */}
			<Dialog open={showArticleModal} onOpenChange={setShowArticleModal}>
				<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>
							{editingArticle ? "Edit Article" : "Create New Article"}
						</DialogTitle>
						<DialogDescription>
							Create educational content for pet owners
						</DialogDescription>
					</DialogHeader>

					<div className="grid gap-4 py-4">
						<div className="grid grid-cols-2 gap-4">
							<div>
								<Label>Title *</Label>
								<Input
									value={articleForm.title}
									onChange={(e) => setArticleForm({ ...articleForm, title: e.target.value })}
									placeholder="e.g. 10 Tips for Puppy Training"
								/>
							</div>
							<div>
								<Label>Slug</Label>
								<Input
									value={articleForm.slug}
									onChange={(e) => setArticleForm({ ...articleForm, slug: e.target.value })}
									placeholder="puppy-training-tips"
								/>
								<p className="text-xs text-gray-500 mt-1">Auto-generated if left empty</p>
							</div>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div>
								<Label>Category</Label>
								<Select
									value={articleForm.category}
									onValueChange={(v: string) => setArticleForm({ ...articleForm, category: v })}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="tips">Training Tips</SelectItem>
										<SelectItem value="nutrition">Nutrition</SelectItem>
										<SelectItem value="health">Health & Wellness</SelectItem>
										<SelectItem value="grooming">Grooming</SelectItem>
										<SelectItem value="insurance">Insurance</SelectItem>
										<SelectItem value="behavior">Behavior</SelectItem>
										<SelectItem value="marketing">General</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div>
								<Label>Read Time</Label>
								<Select
									value={articleForm.read_time}
									onValueChange={(v: string) => setArticleForm({ ...articleForm, read_time: v })}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="2 min">2 min</SelectItem>
										<SelectItem value="3 min">3 min</SelectItem>
										<SelectItem value="5 min">5 min</SelectItem>
										<SelectItem value="7 min">7 min</SelectItem>
										<SelectItem value="10 min">10 min</SelectItem>
										<SelectItem value="15 min">15 min</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>

						<div>
							<Label>Content *</Label>
							<textarea
								value={articleForm.content}
								onChange={(e) => setArticleForm({ ...articleForm, content: e.target.value })}
								placeholder="Write your article content here..."
								className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent min-h-[200px]"
							/>
						</div>

						<div className="flex gap-6 p-3 bg-gray-50 rounded-lg">
							<div className="flex items-center gap-2">
								<Switch
									checked={articleForm.is_published}
									onCheckedChange={(checked: boolean) => setArticleForm({ ...articleForm, is_published: checked })}
								/>
								<Label>Published</Label>
							</div>
							<div className="flex items-center gap-2">
								<Switch
									checked={articleForm.featured}
									onCheckedChange={(checked: boolean) => setArticleForm({ ...articleForm, featured: checked })}
								/>
								<Label>Featured on Home</Label>
							</div>
						</div>
					</div>

					<DialogFooter>
						<Button variant="outline" onClick={() => setShowArticleModal(false)}>
							Cancel
						</Button>
						<Button onClick={handleSaveArticle} className="bg-[#FF8C42] hover:bg-[#FF7A2E]">
							{editingArticle ? 'Update' : 'Create'} Article
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* ANNOUNCEMENT MODAL */}
			<Dialog open={showAnnouncementModal} onOpenChange={setShowAnnouncementModal}>
				<DialogContent className="max-w-lg">
					<DialogHeader>
						<DialogTitle>
							{editingAnnouncement ? "Edit Announcement" : "Create New Announcement"}
						</DialogTitle>
						<DialogDescription>
							Add to the "What's New" section on customer home
						</DialogDescription>
					</DialogHeader>

					<div className="grid gap-4 py-4">
						<div>
							<Label>Title *</Label>
							<Input
								value={announcementForm.title}
								onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })}
								placeholder="e.g. AI Pet Assistant"
							/>
						</div>

						<div>
							<Label>Subtitle</Label>
							<Input
								value={announcementForm.subtitle}
								onChange={(e) => setAnnouncementForm({ ...announcementForm, subtitle: e.target.value })}
								placeholder="e.g. Get instant answers about pet care"
							/>
						</div>

						<div className="grid grid-cols-3 gap-4">
							<div>
								<Label>Badge Text</Label>
								<Input
									value={announcementForm.badge_text}
									onChange={(e) => setAnnouncementForm({ ...announcementForm, badge_text: e.target.value })}
									placeholder="NEW"
								/>
							</div>
							<div>
								<Label>Badge Color</Label>
								<Select
									value={announcementForm.badge_color}
									onValueChange={(v: string) => setAnnouncementForm({ ...announcementForm, badge_color: v })}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="green">Green</SelectItem>
										<SelectItem value="blue">Blue</SelectItem>
										<SelectItem value="purple">Purple</SelectItem>
										<SelectItem value="red">Red (SOS)</SelectItem>
										<SelectItem value="orange">Orange</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div>
								<Label>Icon</Label>
								<Input
									value={announcementForm.icon}
									onChange={(e) => setAnnouncementForm({ ...announcementForm, icon: e.target.value })}
									placeholder="✨"
								/>
							</div>
						</div>

						<div>
							<Label>Announcement Type</Label>
							<Select
								value={announcementForm.announcement_type}
								onValueChange={(v: string) => setAnnouncementForm({ ...announcementForm, announcement_type: v })}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="feature">New Feature</SelectItem>
									<SelectItem value="emergency">Emergency Service</SelectItem>
									<SelectItem value="premium">Premium/Membership</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div>
								<Label>CTA Button Text (optional)</Label>
								<Input
									value={announcementForm.cta_text}
									onChange={(e) => setAnnouncementForm({ ...announcementForm, cta_text: e.target.value })}
									placeholder="Try Now"
								/>
							</div>
							<div>
								<Label>CTA Link</Label>
								<Input
									value={announcementForm.cta_link}
									onChange={(e) => setAnnouncementForm({ ...announcementForm, cta_link: e.target.value })}
									placeholder="/ai-assistant"
								/>
							</div>
						</div>

						<div>
							<Label>Display Order</Label>
							<Input
								type="number"
								value={announcementForm.display_order}
								onChange={(e) => setAnnouncementForm({ ...announcementForm, display_order: parseInt(e.target.value) || 0 })}
								min="0"
							/>
						</div>

						<div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
							<Switch
								checked={announcementForm.is_active}
								onCheckedChange={(checked: boolean) => setAnnouncementForm({ ...announcementForm, is_active: checked })}
							/>
							<Label>Announcement is active</Label>
						</div>
					</div>

					<DialogFooter>
						<Button variant="outline" onClick={() => setShowAnnouncementModal(false)}>
							Cancel
						</Button>
						<Button onClick={handleSaveAnnouncement} className="bg-[#FF8C42] hover:bg-[#FF7A2E]">
							{editingAnnouncement ? 'Update' : 'Create'} Announcement
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</AdminLayout>
	);
}
