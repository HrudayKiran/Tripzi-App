defmodule NxtVibes.Accounts do
  import Ecto.Query, warn: false
  alias NxtVibes.Repo
  alias NxtVibes.Accounts.PublicProfile
  alias NxtVibes.Accounts.Profile

  @doc """
  Gets a single public profile by id (user UUID).
  Returns `nil` if not found.
  """
  def get_public_profile(id) do
    Repo.get(PublicProfile, id)
  end

  @doc """
  Gets a single private profile by id (user UUID).
  Returns `nil` if not found.
  """
  def get_profile(id) do
    Repo.get(Profile, id)
  end

  @doc """
  Bulk retrieves public profiles by list of IDs.
  """
  def list_public_profiles(ids) do
    query = from p in PublicProfile, where: p.id in ^ids
    Repo.all(query)
  end

  @doc """
  Creates or updates a profile.
  """
  def upsert_profile(id, attrs) do
    case get_profile(id) do
      nil ->
        %Profile{id: id}
        |> Profile.changeset(attrs)
        |> Repo.insert()

      %Profile{} = profile ->
        profile
        |> Profile.changeset(attrs)
        |> Repo.update()
    end
  end

  @doc """
  Lists all push tokens for a user.
  """
  def list_push_tokens_for_user(user_id) do
    query = from t in NxtVibes.Accounts.PushToken, where: t.user_id == ^user_id
    Repo.all(query)
  end

  @doc """
  Deletes a specific push token from the database.
  """
  def delete_push_token(token) do
    query = from t in NxtVibes.Accounts.PushToken, where: t.token == ^token
    Repo.delete_all(query)
  end

  @doc """
  Inserts a new notification into the database.
  """
  def create_notification(attrs \\ %{}) do
    %NxtVibes.Accounts.Notification{}
    |> NxtVibes.Accounts.Notification.changeset(attrs)
    |> Repo.insert()
  end
end

