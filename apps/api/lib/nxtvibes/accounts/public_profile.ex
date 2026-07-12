defmodule NxtVibes.Accounts.PublicProfile do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: false}
  schema "public_profiles" do
    field :display_name, :string
    field :name, :string
    field :username, :string
    field :photo_url, :string
    field :gender, :string
    field :last_seen_at, :utc_datetime

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(public_profile, attrs) do
    public_profile
    |> cast(attrs, [:id, :display_name, :name, :username, :photo_url, :gender, :last_seen_at])
    |> validate_required([:id, :display_name])
  end
end
