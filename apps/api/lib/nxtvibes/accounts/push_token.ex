defmodule NxtVibes.Accounts.PushToken do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id
  schema "push_tokens" do
    field :user_id, :binary_id
    field :token, :string
    field :device_info, :string

    timestamps(type: :utc_datetime, inserted_at: :created_at, updated_at: :updated_at)
  end

  @doc false
  def changeset(push_token, attrs) do
    push_token
    |> cast(attrs, [:user_id, :token, :device_info])
    |> validate_required([:user_id, :token])
  end
end
