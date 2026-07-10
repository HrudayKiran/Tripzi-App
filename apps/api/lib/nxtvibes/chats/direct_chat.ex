defmodule NxtVibes.Chats.DirectChat do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id
  schema "direct_chats" do
    # Real columns from Supabase — confirmed via information_schema
    field :participants, {:array, :string}, default: []
    field :participant_details, :map, default: %{}
    field :hidden, :boolean, default: false
    field :last_message, :map
    field :unread_count, :map, default: %{}
    field :deleted_by, {:array, :string}, default: []   # actual column: deleted_by
    field :cleared_at, :map, default: %{}
    field :typing, :map, default: %{}
    field :muted_by, {:array, :string}, default: []
    field :pinned_by, {:array, :string}, default: []

    timestamps(type: :utc_datetime, inserted_at: :created_at, updated_at: :updated_at)
  end

  @doc false
  def changeset(direct_chat, attrs) do
    direct_chat
    |> cast(attrs, [
      :participants,
      :participant_details,
      :hidden,
      :last_message,
      :unread_count,
      :deleted_by,
      :cleared_at,
      :typing,
      :muted_by,
      :pinned_by
    ])
    |> validate_required([:participants])
  end
end
