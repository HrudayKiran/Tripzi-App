defmodule NxtVibes.Chats.GroupChat do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id
  schema "group_chats" do
    # Real columns from Supabase — confirmed via information_schema
    field :group_name, :string
    field :group_description, :string
    field :group_icon, :string
    field :participants, {:array, :string}, default: []
    field :participant_details, :map, default: %{}
    field :created_by, :string
    field :member_count, :integer
    field :hidden, :boolean, default: false
    field :admins, {:array, :string}, default: []
    field :last_message, :map
    field :unread_count, :map, default: %{}
    field :deleted_by, {:array, :string}, default: []   # actual column: deleted_by (not deleted_for)
    field :cleared_at, :map, default: %{}
    field :typing, :map, default: %{}

    timestamps(type: :utc_datetime, inserted_at: :created_at, updated_at: :updated_at)
  end

  @doc false
  def changeset(group_chat, attrs) do
    group_chat
    |> cast(attrs, [
      :group_name,
      :group_description,
      :group_icon,
      :participants,
      :participant_details,
      :created_by,
      :member_count,
      :hidden,
      :admins,
      :last_message,
      :unread_count,
      :deleted_by,
      :cleared_at,
      :typing
    ])
    |> validate_required([:group_name, :participants])
  end
end

