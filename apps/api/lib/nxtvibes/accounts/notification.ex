defmodule NxtVibes.Accounts.Notification do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id
  schema "notifications" do
    field :recipient_id, :binary_id
    field :type, :string
    field :title, :string
    field :message, :string
    field :entity_id, :string
    field :entity_type, :string
    field :deep_link_route, :string
    field :deep_link_params, :map
    field :actor_id, :binary_id
    field :actor_name, :string
    field :is_read, :boolean, default: false

    timestamps(type: :utc_datetime, inserted_at: :created_at, updated_at: false)
  end

  @doc false
  def changeset(notification, attrs) do
    notification
    |> cast(attrs, [
      :recipient_id,
      :type,
      :title,
      :message,
      :entity_id,
      :entity_type,
      :deep_link_route,
      :deep_link_params,
      :actor_id,
      :actor_name,
      :is_read
    ])
    |> validate_required([:recipient_id, :type, :title, :message])
  end
end
