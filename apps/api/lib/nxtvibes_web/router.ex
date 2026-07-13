defmodule NxtVibesWeb.Router do
  use NxtVibesWeb, :router

  pipeline :api do
    plug :accepts, ["json"]
  end

  pipeline :auth do
    plug NxtVibesWeb.Plugs.AuthPlug
  end

  scope "/api", NxtVibesWeb do
    pipe_through :api

    get "/health", HealthController, :check
  end

  scope "/api", NxtVibesWeb do
    pipe_through [:api, :auth]

    post "/groups/create", GroupChatController, :create_group

    post "/group_chats/add-member", GroupChatController, :add_member
    post "/group_chats/remove-member", GroupChatController, :remove_member
    post "/group_chats/leave", GroupChatController, :leave
    post "/group_chats/promote-admin", GroupChatController, :promote_admin
    post "/group_chats/demote-admin", GroupChatController, :demote_admin
    post "/group_chats/update-name", GroupChatController, :update_name
    post "/group_chats/update-icon", GroupChatController, :update_icon

    # WatermelonDB sync endpoints
    get "/sync/pull", SyncController, :pull
    post "/sync/push", SyncController, :push
  end


  # Enable LiveDashboard in development
  if Application.compile_env(:nxtvibes, :dev_routes) do
    # If you want to use the LiveDashboard in production, you should put
    # it behind authentication and allow only admins to access it.
    # If your application does not have an admins-only section yet,
    # you can use Plug.BasicAuth to set up some basic authentication
    # as long as you are also using SSL (which you should anyway).
    import Phoenix.LiveDashboard.Router

    scope "/dev" do
      pipe_through [:fetch_session, :protect_from_forgery]

      live_dashboard "/dashboard", metrics: NxtVibesWeb.Telemetry
    end
  end
end
