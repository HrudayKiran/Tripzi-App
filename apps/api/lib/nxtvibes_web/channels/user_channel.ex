defmodule NxtVibesWeb.UserChannel do
  use NxtVibesWeb, :channel
  alias NxtVibesWeb.Presence
  alias NxtVibes.Repo
  alias NxtVibes.Accounts.Profile

  @impl true
  def join("user:" <> user_id, _params, socket) do
    current_user_id = socket.assigns.current_user_id

    # A user can only subscribe to their own personal user channel
    if user_id == current_user_id do
      send(self(), :after_join)
      {:ok, assign(socket, :user_id, user_id)}
    else
      {:error, %{reason: "unauthorized"}}
    end
  end

  @impl true
  def handle_info(:after_join, socket) do
    # Track this user as online in Phoenix Presence (ETS — NOT a DB write)
    {:ok, _} = Presence.track(socket, socket.assigns.current_user_id, %{
      status: "online",
      online_at: DateTime.utc_now() |> DateTime.to_iso8601()
    })

    # Push full presence state to the newly joined client
    push(socket, "presence_state", Presence.list(socket))
    {:noreply, socket}
  end

  @impl true
  def handle_in("update_presence", %{"status" => status}, socket) do
    user_id = socket.assigns.current_user_id

    # Update presence metadata in ETS (no DB write)
    case Presence.update(socket, user_id, fn meta ->
      Map.merge(meta, %{
        status: status,
        online_at: DateTime.utc_now() |> DateTime.to_iso8601()
      })
    end) do
      {:ok, _} -> {:reply, :ok, socket}
      {:error, _} -> {:reply, :ok, socket}
    end
  end

  @impl true
  def handle_in("update_presence", _params, socket) do
    {:reply, :ok, socket}
  end

  @impl true
  def terminate(_reason, socket) do
    # When the socket disconnects (app killed, network drop, crash), persist last_seen_at
    # to the DB so other users see an accurate "last seen" timestamp.
    # This fires for ALL disconnect reasons — Phoenix guarantees this callback.
    user_id = socket.assigns[:current_user_id]

    if user_id do
      now = DateTime.utc_now() |> DateTime.to_iso8601()

      # Fire-and-forget: we don't need to wait for this to complete
      spawn(fn ->
        try do
          Repo.get(Profile, user_id)
          |> case do
            nil -> :ok
            profile ->
              profile
              |> Profile.changeset(%{"last_seen_at" => now})
              |> Repo.update()
          end
        rescue
          _ -> :ok
        end
      end)
    end

    :ok
  end
end