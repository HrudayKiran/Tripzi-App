defmodule NxtVibes.Itineraries.Itinerary do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id
  schema "itineraries" do
    field :user_id, :binary_id
    field :travel_style, :string, default: "solo"
    field :trip_title, :string
    field :from_location, :string
    field :to_location, :string
    field :from_date, :utc_datetime
    field :to_date, :utc_datetime
    field :duration_days, :integer
    field :trip_types, {:array, :string}, default: []
    field :transport_modes, {:array, :string}, default: []
    field :cost_per_person, :decimal, default: Decimal.new("0")
    field :accommodation_type, :string
    field :booking_status, :string
    field :accommodation_days, :integer
    field :places_to_visit, {:array, :map}, default: []
    field :itinerary, {:array, :string}, default: []
    field :participants, {:array, :binary_id}, default: []
    field :checklist, {:array, :map}, default: []
    field :notes, {:array, :map}, default: []
    field :itinerary_map_view, :map, default: %{}

    timestamps(type: :utc_datetime, inserted_at: :created_at, updated_at: :updated_at)
  end

  @doc false
  def changeset(itinerary, attrs) do
    itinerary
    |> cast(attrs, [
      :user_id,
      :travel_style,
      :trip_title,
      :from_location,
      :to_location,
      :from_date,
      :to_date,
      :duration_days,
      :trip_types,
      :transport_modes,
      :cost_per_person,
      :accommodation_type,
      :booking_status,
      :accommodation_days,
      :places_to_visit,
      :itinerary,
      :participants,
      :checklist,
      :notes,
      :itinerary_map_view
    ])
    |> validate_required([:user_id, :trip_title, :from_date, :to_date])
  end
end
