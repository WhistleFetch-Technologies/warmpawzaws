import { useState, useEffect, useRef } from "react";
import { MapPin, Loader2, Search, Navigation } from "lucide-react";

interface AddressAutocompleteProps {
	onSelect: (address: any) => void;
	placeholder?: string;
	defaultValue?: string;
	className?: string;
}

export function AddressAutocomplete({
	onSelect,
	placeholder = "Search for your address...",
	defaultValue = "",
	className = "",
}: AddressAutocompleteProps) {
	const [query, setQuery] = useState(defaultValue);
	const [suggestions, setSuggestions] = useState<any[]>([]);
	const [loading, setLoading] = useState(false);
	const [showSuggestions, setShowSuggestions] = useState(false);
	const [selectedIndex, setSelectedIndex] = useState(-1);
	const wrapperRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	// Close suggestions when clicking outside
	useEffect(() => {
		function handleClickOutside(event: MouseEvent) {
			if (
				wrapperRef.current &&
				!wrapperRef.current.contains(event.target as Node)
			) {
				setShowSuggestions(false);
			}
		}

		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	// Debounced search
	useEffect(() => {
		if (query.length < 3) {
			setSuggestions([]);
			return;
		}

		const timer = setTimeout(() => {
			searchPlaces(query);
		}, 300);

		return () => clearTimeout(timer);
	}, [query]);

	const searchPlaces = async (input: string) => {
		try {
			setLoading(true);

			const response = await fetch(
				`${getApiBaseUrl()}/places/autocomplete?input=${encodeURIComponent(input)}`,
				{
					headers: {
						...getAuthHeaders(),
					},
				}
			);

			if (response.ok) {
				const data = await response.json();
				setSuggestions(data.predictions || []);
				setShowSuggestions(true);
			}
		} catch (error) {
			console.error("Places autocomplete error:", error);
		} finally {
			setLoading(false);
		}
	};

	const selectPlace = async (prediction: any) => {
		try {
			setQuery(prediction.description);
			setShowSuggestions(false);
			setLoading(true);

			// Get place details
			const response = await fetch(
				`${getApiBaseUrl()}/places/details?placeId=${prediction.placeId}`,
				{
					headers: {
						...getAuthHeaders(),
					},
				}
			);

			if (response.ok) {
				const data = await response.json();
				onSelect({
					fullAddress: data.place.formattedAddress,
					placeId: data.place.placeId,
					area: data.place.addressComponents.area || "",
					city: data.place.addressComponents.city || "",
					state: data.place.addressComponents.state || "",
					pincode: data.place.addressComponents.pincode || "",
					latitude: data.place.location.lat,
					longitude: data.place.location.lng,
					components: data.place.addressComponents,
				});
			}
		} catch (error) {
			console.error("Place details error:", error);
		} finally {
			setLoading(false);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (!showSuggestions || suggestions.length === 0) return;

		switch (e.key) {
			case "ArrowDown":
				e.preventDefault();
				setSelectedIndex((prev) =>
					prev < suggestions.length - 1 ? prev + 1 : prev
				);
				break;
			case "ArrowUp":
				e.preventDefault();
				setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
				break;
			case "Enter":
				e.preventDefault();
				if (selectedIndex >= 0) {
					selectPlace(suggestions[selectedIndex]);
				}
				break;
			case "Escape":
				setShowSuggestions(false);
				setSelectedIndex(-1);
				break;
		}
	};

	const getCurrentLocation = () => {
		if (!navigator.geolocation) {
			alert("Geolocation is not supported by your browser");
			return;
		}

		setLoading(true);
		navigator.geolocation.getCurrentPosition(
			async (position) => {
				try {
					const { latitude, longitude } = position.coords;

					// Reverse geocode
					const response = await fetch(
						`${getApiBaseUrl()}/places/reverse-geocode?lat=${latitude}&lng=${longitude}`,
						{
							headers: {
								...getAuthHeaders(),
							},
						}
					);

					if (response.ok) {
						const data = await response.json();
						setQuery(data.address.formatted);
						onSelect({
							fullAddress: data.address.formatted,
							placeId: data.address.placeId,
							area: data.address.components.area || "",
							city: data.address.components.city || "",
							state: data.address.components.state || "",
							pincode: data.address.components.pincode || "",
							latitude,
							longitude,
							components: data.address.components,
						});
					}
				} catch (error) {
					console.error("Reverse geocode error:", error);
				} finally {
					setLoading(false);
				}
			},
			(error) => {
				console.error("Geolocation error:", error);
				alert("Unable to retrieve your location");
				setLoading(false);
			}
		);
	};

	return (
		<div ref={wrapperRef} className={`relative ${className}`}>
			<div className="relative">
				<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
				<input
					ref={inputRef}
					type="text"
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					onKeyDown={handleKeyDown}
					onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
					placeholder={placeholder}
					className="w-full pl-10 pr-12 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent text-gray-900 placeholder:text-gray-400"
					disabled={loading}
				/>

				{/* Current Location Button */}
				<button
					type="button"
					onClick={getCurrentLocation}
					disabled={loading}
					className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-[#FF8C42] hover:bg-orange-50 rounded-lg transition-colors disabled:opacity-50"
					title="Use current location"
				>
					{loading ? (
						<Loader2 className="w-5 h-5 animate-spin" />
					) : (
						<Navigation className="w-5 h-5" />
					)}
				</button>
			</div>

			{/* Suggestions Dropdown */}
			{showSuggestions && suggestions.length > 0 && (
				<div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg max-h-80 overflow-y-auto">
					{suggestions.map((suggestion, index) => (
						<button
							key={suggestion.placeId}
							type="button"
							onClick={() => selectPlace(suggestion)}
							className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-start gap-3 border-b border-gray-100 last:border-0 ${
								index === selectedIndex ? "bg-orange-50" : ""
							}`}
						>
							<MapPin className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
							<div className="flex-1">
								<div className="text-sm text-gray-900 font-medium">
									{suggestion.mainText}
								</div>
								<div className="text-xs text-gray-500 mt-0.5">
									{suggestion.secondaryText}
								</div>
							</div>
						</button>
					))}
				</div>
			)}

			{/* No Results */}
			{showSuggestions &&
				query.length >= 3 &&
				!loading &&
				suggestions.length === 0 && (
					<div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg p-4 text-center text-gray-500 text-sm">
						No addresses found. Try a different search.
					</div>
				)}
		</div>
	);
}
