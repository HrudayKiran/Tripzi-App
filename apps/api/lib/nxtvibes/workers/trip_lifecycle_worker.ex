defmodule NxtVibes.Workers.TripLifecycleWorker do
  use Oban.Worker, queue: :default, max_attempts: 3
  require Logger
  import Ecto.Query
  alias NxtVibes.Repo
  alias NxtVibes.Itineraries.Itinerary
  alias NxtVibes.Accounts

  @impl Oban.Worker
  def perform(_job) do
    Logger.info("[Scheduler] Running daily itinerary lifecycle...")

    now = DateTime.utc_now()
    today_start = DateTime.new!(DateTime.to_date(now), ~T[00:00:00.000], "Etc/UTC")
    today_end = DateTime.new!(DateTime.to_date(now), ~T[23:59:59.999], "Etc/UTC")

    query =
      from i in Itinerary,
        where: i.from_date >= ^today_start and i.from_date <= ^today_end

    itineraries = Repo.all(query)
    Logger.info("[Scheduler] Found #{length(itineraries)} itineraries starting today.")

    for itin <- itineraries do
      collaborators = itin.participants || []
      all_users = [itin.user_id | collaborators] |> Enum.uniq()

      for uid <- all_users do
        notification_attrs = %{
          recipient_id: uid,
          type: "trip_started",
          title: "🎉 Your itinerary starts today!",
          message: "\"#{itin.trip_title || "Itinerary"}\" begins today. Have an amazing journey!",
          entity_id: to_string(itin.id),
          entity_type: "itinerary",
          deep_link_route: "/trip/itinerary-view"
        }

        case Accounts.create_notification(notification_attrs) do
          {:ok, _notification} ->
            %{
              "chat_id" => to_string(itin.id),
              "chat_type" => "trip_started",
              "sender_id" => "system",
              "recipient_id" => uid,
              "sender_name" => "Tripzi",
              "message_preview" => "\"#{itin.trip_title || "Itinerary"}\" begins today. Have an amazing journey!"
            }
            |> NxtVibes.Workers.PushNotificationWorker.new()
            |> Oban.insert()

            Logger.info("[Scheduler] Queued push notification for user #{uid} on itinerary #{itin.id}.")

          {:error, err} ->
            Logger.error("[Scheduler] Failed to create notification record for user #{uid}: #{inspect(err)}")
        end
      end
    end

    :ok
  end
end
