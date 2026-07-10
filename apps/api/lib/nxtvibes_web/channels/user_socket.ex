defmodule NxtVibesWeb.UserSocket do
  use Phoenix.Socket

  # Channel topic route mappings
  channel "dm:*", NxtVibesWeb.DirectChatChannel
  channel "group:*", NxtVibesWeb.GroupChatChannel
  channel "user:*", NxtVibesWeb.UserChannel

  @impl true
  def connect(%{"token" => token}, socket, _connect_info) do
    # Verify the Supabase JWT token passed by the mobile app on socket connect
    case NxtVibes.Auth.Token.verify_token(token) do
      {:ok, %{"sub" => user_id}} ->
        {:ok, assign(socket, :current_user_id, user_id)}

      {:error, _reason} ->
        :error
    end
  end

  @impl true
  def connect(_params, _socket, _connect_info), do: :error

  @impl true
  def id(socket), do: "user_socket:#{socket.assigns.current_user_id}"
end
