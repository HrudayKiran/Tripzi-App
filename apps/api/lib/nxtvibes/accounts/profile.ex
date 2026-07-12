defmodule NxtVibes.Accounts.Profile do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: false}
  schema "profiles" do
    field :email, :string
    field :name, :string
    field :username, :string
    field :gender, :string
    field :photo_url, :string
    field :photo_object_key, :string
    field :push_notifications_enabled, :boolean, default: false
    field :notification_permission_status, :string, default: "not_determined"
    field :save_to_gallery, :boolean, default: false
    field :last_seen_at, :utc_datetime
    field :last_login_at, :utc_datetime

    timestamps(type: :utc_datetime, inserted_at: :created_at, updated_at: :updated_at)
  end

  @doc false
  def changeset(profile, attrs) do
    profile
    |> cast(attrs, [
      :id,
      :email,
      :name,
      :username,
      :gender,
      :photo_url,
      :photo_object_key,
      :push_notifications_enabled,
      :notification_permission_status,
      :save_to_gallery,
      :last_seen_at,
      :last_login_at
    ])
    |> validate_required([:id, :name])
  end
end
