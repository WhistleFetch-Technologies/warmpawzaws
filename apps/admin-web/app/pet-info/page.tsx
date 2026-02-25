/**
 * Pet Intelligence System
 * Admin access to pet database with analytics and insights
 */
"use client";
import { useState, useEffect } from "react";

import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
	Button,
	Card,
	Input,
} from "@warmpawz/ui";
import {
	Dog,
	Cat,
	Search,
	TrendingUp,
	Heart,
	Activity,
	Download,
	BarChart3,
	PieChart as PieChartIcon,
	Info,
} from "lucide-react";
import {
	PieChart,
	Pie,
	Cell,
	BarChart,
	Bar,
	LineChart,
	Line,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	Legend,
	ResponsiveContainer,
} from "recharts";
import { apiClient } from "@/lib/api-client";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { useRouter } from "next/navigation";

interface PetStats {
	totalPets: number;
	dogCount: number;
	catCount: number;
	otherCount: number;
	avgAge: number;
	topBreeds: Array<{ breed: string; count: number }>;
	healthTrends: Array<{ condition: string; count: number }>;
	ageDistribution: Array<{ ageGroup: string; count: number }>;
}

interface Pet {
	id: string;
	name: string;
	species: string;
	breed: string;
	age: number;
	weight: number;
	healthConditions: string[];
	vaccinations: any[];
	owner: string;
	ownerId: string;
	lastCheckup?: string;
	services: string[];
}

interface BreedInsight {
	breed: string;
	count: number;
	avgAge: number;
	commonServices: string[];
	healthRisk: string;
	avgSpend: number;
}

const COLORS = [
	"#FF8C42",
	"#4F46E5",
	"#10B981",
	"#F59E0B",
	"#EF4444",
	"#8B5CF6",
];

export default function PetIntelligenceSystem() {
	const router = useRouter();
	const [activeTab, setActiveTab] = useState("overview");
	const [stats, setStats] = useState<PetStats | null>(null);
	const [pets, setPets] = useState<Pet[]>([]);
	const [breedInsights, setBreedInsights] = useState<BreedInsight[]>([]);
	const [loading, setLoading] = useState(true);
	const [searchQuery, setSearchQuery] = useState("");
	const [speciesFilter, setSpeciesFilter] = useState("all");

	useEffect(() => {
		loadPetData();
	}, []);

	const loadPetData = async () => {
		setLoading(true);
		try {
			// ✅ FIX: API returns data directly without a 'success' field
			// Load pet statistics
			const statsRes = await apiClient.get<any>("/admin/pets/stats");
			if (statsRes.stats || statsRes.totalPets !== undefined) {
				setStats(statsRes.stats || statsRes);
			}

			// Load all pets (with higher limit to get all pets)
			const petsRes = await apiClient.get<any>("/admin/pets/all?limit=1000");
			const petsData = petsRes.pets || (Array.isArray(petsRes) ? petsRes : []);
			setPets(petsData);

			// Load breed insights
			const insightsRes = await apiClient.get<any>("/admin/pets/breed-insights");
			const insightsData = insightsRes.insights || (Array.isArray(insightsRes) ? insightsRes : []);
			setBreedInsights(insightsData);
		} catch (err) {
			console.error("Error loading pet data:", err);
		} finally {
			setLoading(false);
		}
	};

	// Load vaccination coverage and health recommendations
	useEffect(() => {
		if (activeTab === 'health') {
			loadHealthData();
		}
	}, [activeTab]);

	const [vaccinationCoverage, setVaccinationCoverage] = useState({
		rabies: 0,
		distemper: 0,
		parvovirus: 0,
	});

	const [healthRecommendations, setHealthRecommendations] = useState<any[]>([]);

	const loadHealthData = async () => {
		try {
			// ✅ FIX: API returns data directly without a 'success' field
			// Load vaccination coverage
			const coverageRes = await apiClient.get<any>("/admin/pets/vaccination-coverage");
			if (coverageRes.coverage) {
				setVaccinationCoverage(coverageRes.coverage);
			}

			// Load health recommendations
			const recommendationsRes = await apiClient.get<any>("/admin/pets/health-recommendations");
			const recsData = recommendationsRes.recommendations || (Array.isArray(recommendationsRes) ? recommendationsRes : []);
			setHealthRecommendations(recsData);
		} catch (err) {
			console.error("Error loading health data:", err);
		}
	};

	const exportPetData = () => {
		try {
			const csvRows = [];

			csvRows.push("Warmpawz Pet Database Export");
			csvRows.push(`Generated: ${new Date().toLocaleString()}`);
			csvRows.push(`Total Pets: ${pets.length}`);
			csvRows.push("");

			csvRows.push(
				"Pet ID,Name,Species,Breed,Age (years),Weight (kg),Owner Name,Owner Phone,Health Conditions"
			);
			
			// Export all pets (not just filtered ones) for complete export
			const petsToExport = pets.length > 0 ? pets : [];
			
			if (petsToExport.length === 0) {
				alert("No pet data available to export");
				return;
			}

			petsToExport.forEach((pet) => {
				// Escape CSV values (handle commas, quotes, newlines)
				const escapeCsv = (value: any) => {
					if (value === null || value === undefined) return '';
					const str = String(value);
					if (str.includes(',') || str.includes('"') || str.includes('\n')) {
						return `"${str.replace(/"/g, '""')}"`;
					}
					return str;
				};

				csvRows.push(
					[
						escapeCsv(pet.id),
						escapeCsv(pet.name),
						escapeCsv(pet.species),
						escapeCsv(pet.breed),
						escapeCsv(pet.age),
						escapeCsv(pet.weight),
						escapeCsv(pet.owner),
						escapeCsv((pet.healthConditions || []).join("; ")),
					].join(",")
				);
			});

			const csvContent = csvRows.join("\n");
			const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
			const url = URL.createObjectURL(blob);
			const link = document.createElement("a");
			link.href = url;
			link.download = `pets-database-${Date.now()}.csv`;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			URL.revokeObjectURL(url);

			console.log(`✅ Pet data exported: ${petsToExport.length} pets`);
		} catch (err) {
			console.error("Export error:", err);
			alert("Failed to export pet data: " + (err as Error).message);
		}
	};

	const filteredPets = pets.filter((pet) => {
		if (!pet) return false;

		const searchLower = searchQuery.toLowerCase();
		const matchesSearch =
			!searchQuery ||
			(pet.name && pet.name.toLowerCase().includes(searchLower)) ||
			(pet.breed && pet.breed.toLowerCase().includes(searchLower)) ||
			(pet.owner && pet.owner.toLowerCase().includes(searchLower)) ||
			(pet.species && pet.species.toLowerCase().includes(searchLower));

		const petSpeciesLower = pet.species?.toLowerCase() || '';
		const matchesSpecies =
			speciesFilter === "all" ||
			(speciesFilter === "dog" && (petSpeciesLower === "dog" || petSpeciesLower === "dogs")) ||
			(speciesFilter === "cat" && (petSpeciesLower === "cat" || petSpeciesLower === "cats")) ||
			(speciesFilter === "other" && petSpeciesLower !== "dog" && petSpeciesLower !== "cat" && petSpeciesLower !== "dogs" && petSpeciesLower !== "cats");

		return matchesSearch && matchesSpecies;
	});

	if (loading) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-gray-50">
				<div className="text-center">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto"></div>
					<p className="mt-4 text-gray-600">Loading pet intelligence...</p>
				</div>
			</div>
		);
	}

	return (
		<AdminLayout>
			<div className="flex-1 flex flex-col min-h-screen bg-gray-50">
				{/* Header - Match wireframe: border-b, max-w-7xl mx-auto px-6 py-4 */}
				<div className="bg-white border-b border-gray-200 sticky top-0 z-10">
					<div className="max-w-7xl mx-auto px-6 py-4">
						<div className="flex items-center justify-between">
							<div>
								{/* ✅ FIX: Match wireframe - text-2xl font-bold text-gray-900 */}
								<h1 className="text-2xl font-bold text-gray-900">
									Pet Intelligence System
								</h1>
								<p className="text-sm text-gray-500 mt-1">
									Pet database & breed insights
								</p>
							</div>
							<div className="flex items-center gap-3">
								<span className="text-sm text-gray-600">
									{stats?.totalPets || 0} pets registered
								</span>
								<Button variant="outline" onClick={exportPetData}>
									<Download className="w-4 h-4 mr-2" />
									Export
								</Button>
							</div>
						</div>
					</div>
				</div>

				{/* Content - Match wireframe: max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 */}
				<div className="flex-1 overflow-y-auto">
					<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
					{/* Stats Cards */}
					<div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
						<Card className="p-6">
							<div className="flex items-center justify-between mb-2">
								<Dog className="w-8 h-8 text-orange-600" />
								<TrendingUp className="w-4 h-4 text-green-600" />
							</div>
							<h3 className="text-2xl font-bold">{stats?.totalPets || 0}</h3>
							<p className="text-sm text-gray-600">Total Pets</p>
						</Card>

						<Card className="p-6">
							<div className="flex items-center justify-between mb-2">
								<Dog className="w-8 h-8 text-blue-600" />
							</div>
							<h3 className="text-2xl font-bold">{stats?.dogCount || 0}</h3>
							<p className="text-sm text-gray-600">Dogs</p>
						</Card>

						<Card className="p-6">
							<div className="flex items-center justify-between mb-2">
								<Cat className="w-8 h-8 text-purple-600" />
							</div>
							<h3 className="text-2xl font-bold">{stats?.catCount || 0}</h3>
							<p className="text-sm text-gray-600">Cats</p>
						</Card>

						<Card className="p-6">
							<div className="flex items-center justify-between mb-2">
								<Heart className="w-8 h-8 text-red-600" />
							</div>
							<h3 className="text-2xl font-bold">
								{stats?.avgAge?.toFixed(1) || 0} yrs
							</h3>
							<p className="text-sm text-gray-600">Avg Age</p>
						</Card>
					</div>

					<Tabs value={activeTab} onValueChange={setActiveTab}>
						<TabsList className="mb-6">
							<TabsTrigger value="overview">
								<BarChart3 className="w-4 h-4 mr-2" />
								Overview
							</TabsTrigger>
							<TabsTrigger value="breeds">
								<PieChartIcon className="w-4 h-4 mr-2" />
								Breed Insights
							</TabsTrigger>
							<TabsTrigger value="database">
								<Search className="w-4 h-4 mr-2" />
								Pet Database
							</TabsTrigger>
							<TabsTrigger value="health">
								<Activity className="w-4 h-4 mr-2" />
								Health Trends
							</TabsTrigger>
						</TabsList>

						{/* Overview Tab */}
						<TabsContent value="overview" className="space-y-6">
							<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
								{/* Species Distribution */}
								<Card className="p-6">
									<h3 className="font-semibold mb-4">Species Distribution</h3>
									<ResponsiveContainer width="100%" height={300}>
										<PieChart>
											<Pie
												data={[
													{ name: "Dogs", value: stats?.dogCount || 0 },
													{ name: "Cats", value: stats?.catCount || 0 },
													{ name: "Others", value: stats?.otherCount || 0 },
												]}
												cx="50%"
												cy="50%"
												labelLine={false}
												label={(entry) => `${entry.name}: ${entry.value}`}
												outerRadius={100}
												fill="#8884d8"
												dataKey="value"
											>
												{[0, 1, 2].map((entry, index) => (
													<Cell
														key={`cell-${index}`}
														fill={COLORS[index % COLORS.length]}
													/>
												))}
											</Pie>
											<Tooltip />
										</PieChart>
									</ResponsiveContainer>
								</Card>

								{/* Age Distribution */}
								<Card className="p-6">
									<h3 className="font-semibold mb-4">Age Distribution</h3>
									<ResponsiveContainer width="100%" height={300}>
										<BarChart data={stats?.ageDistribution || []}>
											<CartesianGrid strokeDasharray="3 3" />
											<XAxis dataKey="ageGroup" />
											<YAxis />
											<Tooltip />
											<Bar dataKey="count" fill="#FF8C42" />
										</BarChart>
									</ResponsiveContainer>
								</Card>

								{/* Top Breeds */}
								<Card className="p-6 lg:col-span-2">
									<h3 className="font-semibold mb-4">Top 10 Breeds</h3>
									<ResponsiveContainer width="100%" height={300}>
										<BarChart data={stats?.topBreeds?.slice(0, 10) || []}>
											<CartesianGrid strokeDasharray="3 3" />
											<XAxis
												dataKey="breed"
												angle={-45}
												textAnchor="end"
												height={100}
											/>
											<YAxis />
											<Tooltip />
											<Bar dataKey="count" fill="#4F46E5" />
										</BarChart>
									</ResponsiveContainer>
								</Card>
							</div>
						</TabsContent>

						{/* Breed Insights Tab */}
						<TabsContent value="breeds" className="space-y-6">
							<Card className="p-6">
								<h3 className="font-semibold mb-4">
									Breed Intelligence & Insights
								</h3>
								<div className="overflow-x-auto">
									<table className="w-full">
										<thead className="bg-gray-50">
											<tr>
												<th className="px-4 py-3 text-left text-sm font-semibold">
													Breed
												</th>
												<th className="px-4 py-3 text-left text-sm font-semibold">
													Count
												</th>
												<th className="px-4 py-3 text-left text-sm font-semibold">
													Avg Age
												</th>
												<th className="px-4 py-3 text-left text-sm font-semibold">
													Common Services
												</th>
												<th className="px-4 py-3 text-left text-sm font-semibold">
													Health Risk
												</th>
												<th className="px-4 py-3 text-left text-sm font-semibold">
													Avg Spend
												</th>
											</tr>
										</thead>
										<tbody>
											{breedInsights.map((insight) => (
												<tr
													key={insight.breed}
													className="border-t hover:bg-gray-50"
												>
													<td className="px-4 py-3 font-medium">
														{insight.breed}
													</td>
													<td className="px-4 py-3">{insight.count}</td>
													<td className="px-4 py-3">
														{insight.avgAge.toFixed(1)} yrs
													</td>
													<td className="px-4 py-3 text-sm">
														{insight.commonServices.slice(0, 2).join(", ")}
													</td>
													<td className="px-4 py-3">
														<span
															className={`px-2 py-1 text-xs rounded ${
																insight.healthRisk === "High"
																	? "bg-red-100 text-red-800"
																	: insight.healthRisk === "Medium"
																		? "bg-yellow-100 text-yellow-800"
																		: "bg-green-100 text-green-800"
															}`}
														>
															{insight.healthRisk}
														</span>
													</td>
													<td className="px-4 py-3">
														₹{insight.avgSpend.toLocaleString()}
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							</Card>
						</TabsContent>

						{/* Pet Database Tab */}
						<TabsContent value="database" className="space-y-6">
							{/* Search & Filters */}
							<Card className="p-4">
								<div className="flex gap-4">
									<div className="flex-1 relative">
										<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
										<Input
											type="text"
											value={searchQuery}
											onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
												setSearchQuery(e.target.value)
											}
											placeholder="Search by pet name, breed, or owner..."
											className="w-full pl-10 pr-4 py-2"
										/>
									</div>
									<Select value={speciesFilter} onValueChange={setSpeciesFilter}>
										<SelectTrigger className="w-40">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="all">All Species</SelectItem>
											<SelectItem value="dog">Dogs Only</SelectItem>
											<SelectItem value="cat">Cats Only</SelectItem>
											<SelectItem value="other">Others</SelectItem>
										</SelectContent>
									</Select>
								</div>
							</Card>

							{/* Pet List */}
							<Card className="p-6">
								<div className="space-y-4">
									{filteredPets.map((pet) => (
										<div
											key={pet.id}
											className="border rounded-lg p-4 hover:bg-gray-50"
										>
											<div className="flex items-start justify-between">
												<div className="flex items-start gap-4">
													<div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center">
														{pet.species.toLowerCase() === "dog" ? (
															<Dog className="w-6 h-6 text-white" />
														) : pet.species.toLowerCase() === "cat" ? (
															<Cat className="w-6 h-6 text-white" />
														) : (
															<Heart className="w-6 h-6 text-white" />
														)}
													</div>
													<div>
														<h4 className="font-semibold">{pet.name}</h4>
														<p className="text-sm text-gray-600">{pet.breed}</p>
														<div className="flex gap-4 mt-2 text-sm text-gray-500">
															<span>{pet.age} years old</span>
															<span>•</span>
															<span>{pet.weight} kg</span>
															<span>•</span>
															<span>Owner: {pet.owner}</span>
														</div>
														{pet.healthConditions &&
															pet.healthConditions.length > 0 && (
																<div className="flex gap-2 mt-2">
																	{pet.healthConditions.map((condition, idx) => (
																		<span
																			key={idx}
																			className="px-2 py-1 bg-red-50 text-red-700 text-xs rounded"
																		>
																			{condition}
																		</span>
																	))}
																</div>
															)}
													</div>
												</div>
												<Button variant="ghost" size="sm">
													<Info className="w-4 h-4" />
												</Button>
											</div>
										</div>
									))}

									{filteredPets.length === 0 && (
										<div className="text-center py-12 text-gray-500">
											<Dog className="w-12 h-12 mx-auto mb-4 opacity-50" />
											<p>No pets found matching your criteria</p>
										</div>
									)}
								</div>
							</Card>
						</TabsContent>

						{/* Health Trends Tab */}
						<TabsContent value="health" className="space-y-6">
							<Card className="p-6">
								<h3 className="font-semibold mb-4">Common Health Conditions</h3>
								<ResponsiveContainer width="100%" height={400}>
									<BarChart data={stats?.healthTrends || []}>
										<CartesianGrid strokeDasharray="3 3" />
										<XAxis
											dataKey="condition"
											angle={-45}
											textAnchor="end"
											height={120}
										/>
										<YAxis />
										<Tooltip />
										<Legend />
										<Bar dataKey="count" fill="#EF4444" />
									</BarChart>
								</ResponsiveContainer>
							</Card>

							<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
								<Card className="p-6">
									<h3 className="font-semibold mb-4">Vaccination Coverage</h3>
									<div className="space-y-3">
										<div>
											<div className="flex justify-between text-sm mb-1">
												<span>Rabies</span>
												<span>{vaccinationCoverage.rabies}%</span>
											</div>
											<div className="w-full bg-gray-200 rounded-full h-2">
												<div
													className={`h-2 rounded-full ${
														vaccinationCoverage.rabies >= 80 ? 'bg-green-600' :
														vaccinationCoverage.rabies >= 50 ? 'bg-yellow-600' : 'bg-red-600'
													}`}
													style={{ width: `${Math.min(vaccinationCoverage.rabies, 100)}%` }}
												></div>
											</div>
										</div>
										<div>
											<div className="flex justify-between text-sm mb-1">
												<span>Distemper</span>
												<span>{vaccinationCoverage.distemper}%</span>
											</div>
											<div className="w-full bg-gray-200 rounded-full h-2">
												<div
													className={`h-2 rounded-full ${
														vaccinationCoverage.distemper >= 80 ? 'bg-green-600' :
														vaccinationCoverage.distemper >= 50 ? 'bg-yellow-600' : 'bg-red-600'
													}`}
													style={{ width: `${Math.min(vaccinationCoverage.distemper, 100)}%` }}
												></div>
											</div>
										</div>
										<div>
											<div className="flex justify-between text-sm mb-1">
												<span>Parvovirus</span>
												<span>{vaccinationCoverage.parvovirus}%</span>
											</div>
											<div className="w-full bg-gray-200 rounded-full h-2">
												<div
													className={`h-2 rounded-full ${
														vaccinationCoverage.parvovirus >= 80 ? 'bg-green-600' :
														vaccinationCoverage.parvovirus >= 50 ? 'bg-yellow-600' : 'bg-red-600'
													}`}
													style={{ width: `${Math.min(vaccinationCoverage.parvovirus, 100)}%` }}
												></div>
											</div>
										</div>
									</div>
								</Card>

								<Card className="p-6">
									<h3 className="font-semibold mb-4">Health Recommendations</h3>
									<div className="space-y-3">
										{healthRecommendations.length > 0 ? (
											healthRecommendations.map((rec, idx) => (
												<div key={idx} className="flex items-start gap-3">
													<div className={`w-2 h-2 rounded-full mt-2 ${
														rec.priority === 'high' ? 'bg-red-600' :
														rec.priority === 'medium' ? 'bg-yellow-600' : 'bg-green-600'
													}`}></div>
													<div>
														<p className="font-medium text-sm">{rec.title}</p>
														<p className="text-xs text-gray-600">{rec.message}</p>
													</div>
												</div>
											))
										) : (
											<p className="text-sm text-gray-500">No recommendations at this time</p>
										)}
									</div>
								</Card>
							</div>
						</TabsContent>
					</Tabs>
					</div>
				</div>
			</div>
		</AdminLayout>
	);
}

