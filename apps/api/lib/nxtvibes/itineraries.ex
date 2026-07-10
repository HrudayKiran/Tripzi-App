defmodule NxtVibes.Itineraries do
  import Ecto.Query, warn: false
  alias NxtVibes.Repo
  alias NxtVibes.Itineraries.Itinerary

  @doc """
  Gets a single itinerary by ID.
  """
  def get_itinerary(id), do: Repo.get(Itinerary, id)

  @doc """
  Lists itineraries for a given user, optionally filtered by updated_at date.
  Matches user_id or if user is in participants list.
  """
  def list_itineraries_for_user(user_id, updated_since \\ nil) do
    query =
      from i in Itinerary,
        where: i.user_id == ^user_id or fragment("? = ANY(?)", ^user_id, i.participants)

    query =
      if updated_since do
        from i in query, where: i.updated_at > ^updated_since
      else
        query
      end

    Repo.all(query)
  end

  @doc """
  Creates an itinerary.
  """
  def create_itinerary(attrs \\ %{}) do
    %Itinerary{}
    |> Itinerary.changeset(attrs)
    |> Repo.insert()
  end

  @doc """
  Updates an itinerary.
  """
  def update_itinerary(%Itinerary{} = itinerary, attrs) do
    itinerary
    |> Itinerary.changeset(attrs)
    |> Repo.update()
  end
end
