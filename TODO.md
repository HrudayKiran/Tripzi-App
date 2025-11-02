# TODO: Update CreateTrip.tsx with Trip Preferences

## Tasks
- [x] Update Zod schema to include gender_preference and transport_type validation
- [x] Add gender_preference and transport_type to formData state with defaults
- [x] Update loadTripData to load existing gender_preference and transport_type values
- [x] Add UI components for gender_preference (Select with options: Male, Female, Male and Female)
- [x] Add UI components for transport_type (Select with options: Train, Bus, Bike, Car, Flight, Other; show text input when Other selected)
- [x] Update handleSubmit to include gender_preference and transport_type in database insert/update
- [x] Test form submission and editing functionality
- [x] Fix currency display from $ to ₹
- [x] Fix gender preference to show placeholder instead of pre-selected value
- [x] Fix database schema and constraints for trip preferences
