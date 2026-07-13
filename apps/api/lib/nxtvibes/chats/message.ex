defmodule NxtVibes.Chats.Message do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id
  schema "messages" do
    field :chat_id, :binary_id
    field :chat_type, :string
    field :sender_id, :string
    field :sender_name, :string
    field :text, :string
    field :type, :string
    field :media_url, :string
    field :location, :map
    field :reply_to, :binary_id
    field :status, :string
    field :read_by, :map, default: %{}
    field :delivered_to, {:array, :string}, default: []
    field :deleted_for, {:array, :string}, default: []
    field :deleted_for_everyone_at, :utc_datetime
    field :mentions, {:array, :string}, default: []
    field :edited_at, :utc_datetime

    timestamps(type: :utc_datetime, inserted_at: :created_at, updated_at: :updated_at)
  end

  @doc false
  def changeset(message, attrs) do
    message
    |> cast(attrs, [
      :id,
      :chat_id,
      :chat_type,
      :sender_id,
      :sender_name,
      :text,
      :type,
      :media_url,
      :location,
      :reply_to,
      :status,
      :read_by,
      :delivered_to,
      :deleted_for,
      :deleted_for_everyone_at,
      :mentions,
      :edited_at
    ])
    |> validate_required([:chat_id, :chat_type, :sender_id, :sender_name, :type, :status])
  end
end

