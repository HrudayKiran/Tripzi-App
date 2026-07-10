defmodule NxtVibesWeb.UserChannel do
  use NxtVibesWeb, :channel

  @impl true
  def join("user:" <> user_id, _params, socket) do
    current_user_id = socket.assigns.current_user_id

    # A user can only subscribe to their own personal user channel
    if user_id == current_user_id do
      {:ok, socket}
    else
      {:error, %{reason: "unauthorized"}}
    end
  end
end
