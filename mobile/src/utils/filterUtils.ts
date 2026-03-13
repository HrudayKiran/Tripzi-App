import { FilterOptions } from '../components/FilterModal';

export const applyTripFilters = (
    trips: any[],
    searchQuery: string,
    filters: FilterOptions | null,
    currentUserUid?: string,
    isHomeFeed: boolean = false
) => {
    let result = [...trips];

    // 1. Base Visibility Rules (Always apply these to ensure consistency)
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    result = result.filter((trip) => {
        // Exclude current user's trips only on Home Feed
        if (isHomeFeed && currentUserUid && trip.userId === currentUserUid) {
            return false;
        }

        // Exclude expired trips
        if (trip.isExpired === true) return false;

        // Exclude cancelled trips
        if (trip.status === 'cancelled' || trip.isCancelled === true) return false;

        // Exclude completed trips
        if (trip.isCompleted === true) return false;

        // Exclude trips past their start date
        const fromDate = trip.fromDate?.toDate ? trip.fromDate.toDate() :
            trip.fromDate ? new Date(trip.fromDate) : null;
        
        if (fromDate && fromDate < todayStart) return false;

        // Exclude full trips
        const participants = trip.participants?.length || trip.currentTravelers || 1;
        const maxTravelers = trip.maxTravelers || 10;
        if (participants >= maxTravelers) return false;

        return true;
    });

    // 2. Search Query Filter
    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        result = result.filter(trip =>
            trip.title?.toLowerCase().includes(query) ||
            trip.location?.toLowerCase().includes(query) ||
            trip.toLocation?.toLowerCase().includes(query) ||
            trip.startingFrom?.toLowerCase().includes(query) ||
            trip.fromLocation?.toLowerCase().includes(query)
        );
    }

    // 3. User Selected Filters
    if (filters) {
        if (filters.destination) {
            const dest = filters.destination.toLowerCase();
            result = result.filter(trip =>
                trip.location?.toLowerCase().includes(dest) ||
                trip.toLocation?.toLowerCase().includes(dest)
            );
        }
        
        if (filters.startingFrom) {
            const starting = filters.startingFrom.toLowerCase();
            result = result.filter(trip =>
                trip.startingFrom?.toLowerCase().includes(starting) ||
                trip.fromLocation?.toLowerCase().includes(starting)
            );
        }

        if (filters.maxCost !== undefined) {
            result = result.filter(trip => (trip.cost || 0) <= filters.maxCost);
        }

        if (filters.maxTravelers && filters.maxTravelers < 50) {
            result = result.filter(trip => (trip.maxTravelers || 10) <= filters.maxTravelers);
        }

        if (filters.minDays && filters.minDays > 1) {
            result = result.filter(trip => (trip.duration || 1) >= filters.minDays);
        }

        // Multi-select trip types
        if (filters.tripTypes && filters.tripTypes.length > 0) {
            result = result.filter(trip =>
                trip.tripTypes?.some((t: string) => filters.tripTypes!.includes(t.toLowerCase())) ||
                filters.tripTypes!.includes(trip.tripType?.toLowerCase())
            );
        } else if (filters.tripType) {
            result = result.filter(trip =>
                trip.tripTypes?.some((t: string) => t.toLowerCase().includes(filters.tripType!.toLowerCase()))
            );
        }

        // Multi-select transport modes
        if (filters.transportModes && filters.transportModes.length > 0) {
            result = result.filter(trip =>
                trip.transportModes?.some((t: string) => filters.transportModes!.includes(t.toLowerCase())) ||
                filters.transportModes!.includes(trip.transportMode?.toLowerCase())
            );
        } else if (filters.transportMode) {
            result = result.filter(trip =>
                trip.transportModes?.some((t: string) => t.toLowerCase().includes(filters.transportMode!.toLowerCase()))
            );
        }

        if (filters.genderPreference && filters.genderPreference !== 'anyone') {
            result = result.filter(trip =>
                trip.genderPreference === filters.genderPreference || trip.genderPreference === 'anyone'
            );
        }

        if (filters.accommodationType) {
            result = result.filter(trip =>
                trip.accommodationType?.toLowerCase() === filters.accommodationType
            );
        }

        if (filters.bookingStatus) {
            result = result.filter(trip =>
                trip.bookingStatus?.toLowerCase() === filters.bookingStatus
            );
        }

        // NEW: Date Range Filter
        if (filters.startDate) {
            const filterStart = new Date(filters.startDate);
            result = result.filter(trip => {
                const tripStart = trip.fromDate?.toDate ? trip.fromDate.toDate() :
                    trip.fromDate ? new Date(trip.fromDate) : null;
                return !tripStart || tripStart >= filterStart;
            });
        }

        if (filters.endDate) {
            const filterEnd = new Date(filters.endDate);
            filterEnd.setHours(23, 59, 59, 999); // Make inclusive of the entire day
            result = result.filter(trip => {
                const tripEnd = trip.toDate?.toDate ? trip.toDate.toDate() :
                    trip.toDate ? new Date(trip.toDate) : null;
                return !tripEnd || tripEnd <= filterEnd;
            });
        }

        // 4. Sorting
        if (filters.sortBy) {
            switch (filters.sortBy) {
                case 'newest':
                    result.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
                    break;
                case 'oldest':
                    result.sort((a, b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0));
                    break;
                case 'lowestCost':
                    result.sort((a, b) => (a.cost || 0) - (b.cost || 0));
                    break;
                case 'highestCost':
                    result.sort((a, b) => (b.cost || 0) - (a.cost || 0));
                    break;
            }
        }
    }

    return result;
};
