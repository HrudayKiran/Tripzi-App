defmodule NxtVibesWeb.SyncController do
  use NxtVibesWeb, :controller

  alias NxtVibes.Accounts
  alias NxtVibes.Chats
  alias NxtVibes.Itineraries
  alias NxtVibes.Repo
  alias NxtVibes.Accounts.Profile
  alias NxtVibes.Chats.DirectChat
  alias NxtVibes.Chats.GroupChat
  alias NxtVibes.Chats.Message
  alias NxtVibes.Itineraries.Itinerary

  # Helper to parse last_pulled_at timestamp
  defp parse_timestamp(nil), do: nil
  defp parse_timestamp(""), do: nil
  defp parse_timestamp(ts) when is_integer(ts) do
    case DateTime.from_unix(ts, :millisecond) do
      {:ok, dt} -> dt
      _ -> nil
    end
  end
  defp parse_timestamp(ts) when is_binary(ts) do
    case Integer.parse(ts) do
      {num, ""} ->
        case DateTime.from_unix(num, :millisecond) do
          {:ok, dt} -> dt
          _ -> nil
        end
      _ ->
        case DateTime.from_iso8601(ts) do
          {:ok, dt, _offset} -> dt
          _ -> nil
        end
    end
  end

  # Helper to convert DateTime to unix ms
  defp to_ms(nil), do: nil
  defp to_ms(%DateTime{} = dt), do: DateTime.to_unix(dt, :millisecond)
  defp to_ms(%NaiveDateTime{} = ndt) do
    ndt
    |> DateTime.from_naive!("Etc/UTC")
    |> DateTime.to_unix(:millisecond)
  end

  # Formatting maps for WatermelonDB sync response
  defp map_itinerary(i) do
    %{
      id: i.id,
      user_id: i.user_id,
      travel_style: i.travel_style,
      trip_title: i.trip_title,
      from_location: i.from_location,
      to_location: i.to_location,
      # WatermelonDB stores from_date/to_date as `string` columns — send ISO 8601 strings
      from_date: if(i.from_date, do: DateTime.to_iso8601(i.from_date), else: nil),
      to_date: if(i.to_date, do: DateTime.to_iso8601(i.to_date), else: nil),
      duration_days: i.duration_days,
      trip_types: Jason.encode!(i.trip_types || []),
      transport_modes: Jason.encode!(i.transport_modes || []),
      # Decimal → float so JSON doesn't emit a Decimal struct
      cost_per_person: if(i.cost_per_person, do: Decimal.to_float(i.cost_per_person), else: nil),
      accommodation_type: i.accommodation_type,
      booking_status: i.booking_status,
      accommodation_days: i.accommodation_days,
      places_to_visit: Jason.encode!(i.places_to_visit || []),
      itinerary: Jason.encode!(i.itinerary || []),
      participants: Jason.encode!(i.participants || []),
      checklist: Jason.encode!(i.checklist || []),
      notes: Jason.encode!(i.notes || []),
      itinerary_map_view: if(i.itinerary_map_view && map_size(i.itinerary_map_view) > 0, do: Jason.encode!(i.itinerary_map_view), else: nil),
      created_at: to_ms(i.created_at),
      updated_at: to_ms(i.updated_at)
    }
  end

  defp map_profile(p) do
    # public_profiles doesn't have email or push permissions
    display_name = Map.get(p, :display_name) || Map.get(p, :name) || "Traveler"
    name = Map.get(p, :name) || display_name
    push_enabled = Map.get(p, :push_notifications_enabled) || false
    save_to_gallery = Map.get(p, :save_to_gallery) || false

    %{
      id: p.id,
      name: name,
      username: p.username,
      photo_url: p.photo_url,
      push_notifications_enabled: push_enabled,
      save_to_gallery: save_to_gallery,
      created_at: to_ms(p.created_at),
      updated_at: to_ms(p.updated_at)
    }
  end


  defp map_direct_chat(c) do
    # Extract last_message_at from inside the last_message JSONB object
    # DB has no separate last_message_at column; it's stored as last_message.created_at
    last_message_at =
      case c.last_message do
        %{"created_at" => ts} when is_binary(ts) ->
          case DateTime.from_iso8601(ts) do
            {:ok, dt, _} -> DateTime.to_unix(dt, :millisecond)
            _ -> nil
          end
        _ -> nil
      end

    %{
      id: c.id,
      participants: Jason.encode!(c.participants || []),
      participant_details: if(c.participant_details && map_size(c.participant_details) > 0, do: Jason.encode!(c.participant_details), else: nil),
      last_message: if(c.last_message && map_size(c.last_message) > 0, do: Jason.encode!(c.last_message), else: nil),
      last_message_at: last_message_at,
      unread_count: if(c.unread_count && map_size(c.unread_count) > 0, do: Jason.encode!(c.unread_count), else: nil),
      cleared_at: if(c.cleared_at && map_size(c.cleared_at) > 0, do: Jason.encode!(c.cleared_at), else: nil),
      deleted_for: Jason.encode!(c.deleted_for || []),
      typing: if(c.typing && map_size(c.typing) > 0, do: Jason.encode!(c.typing), else: nil),
      created_at: to_ms(c.created_at),
      updated_at: to_ms(c.updated_at)
    }
  end

  defp map_group_chat(gc) do
    %{
      id: gc.id,
      group_name: gc.group_name,
      group_description: gc.group_description,
      group_icon: gc.group_icon,
      participants: Jason.encode!(gc.participants || []),
      participant_details: if(gc.participant_details && map_size(gc.participant_details) > 0, do: Jason.encode!(gc.participant_details), else: nil),
      created_by: gc.created_by,
      member_count: gc.member_count,
      hidden: gc.hidden || false,
      admins: Jason.encode!(gc.admins || []),
      last_message: if(gc.last_message && map_size(gc.last_message) > 0, do: Jason.encode!(gc.last_message), else: nil),
      unread_count: if(gc.unread_count && map_size(gc.unread_count) > 0, do: Jason.encode!(gc.unread_count), else: nil),
      cleared_at: if(gc.cleared_at && map_size(gc.cleared_at) > 0, do: Jason.encode!(gc.cleared_at), else: nil),
      deleted_for: Jason.encode!(gc.deleted_for || []),
      typing: if(gc.typing && map_size(gc.typing) > 0, do: Jason.encode!(gc.typing), else: nil),
      created_at: to_ms(gc.created_at),
      updated_at: to_ms(gc.updated_at)
    }
  end

  defp map_message(m) do
    %{
      id: m.id,
      chat_id: m.chat_id,
      chat_type: m.chat_type,
      sender_id: m.sender_id,
      sender_name: m.sender_name,
      type: m.type,
      text: m.text,
      media_url: m.media_url,
      location: if(m.location, do: Jason.encode!(m.location), else: nil),
      # voice_duration is a Decimal — convert to float for JSON
      voice_duration: if(m.voice_duration, do: Decimal.to_float(m.voice_duration), else: nil),
      # reply_to is a UUID binary — WatermelonDB stores it as a JSON string in the `reply_to` field
      reply_to: nil,
      status: m.status,
      read_by: if(m.read_by && map_size(m.read_by) > 0, do: Jason.encode!(m.read_by), else: nil),
      delivered_to: if(m.delivered_to && length(m.delivered_to) > 0, do: Jason.encode!(m.delivered_to), else: nil),
      edited_at: if(m.edited_at, do: to_ms(m.edited_at), else: nil),
      deleted_for: if(m.deleted_for && length(m.deleted_for) > 0, do: Jason.encode!(m.deleted_for), else: nil),
      deleted_for_everyone_at: if(m.deleted_for_everyone_at, do: to_ms(m.deleted_for_everyone_at), else: nil),
      mentions: if(m.mentions && length(m.mentions) > 0, do: Jason.encode!(m.mentions), else: nil),
      created_at: to_ms(m.created_at),
      updated_at: to_ms(m.updated_at)
    }
  end

  @doc """
  GET /api/sync/pull
  Body/Query: %{"last_pulled_at" => last_pulled_at}
  """
  def pull(conn, params) do
    user_id = conn.assigns.current_user_id
    last_pulled_at = params["last_pulled_at"]

    updated_since = parse_timestamp(last_pulled_at)

    # 1. Fetch itineraries
    itineraries = Itineraries.list_itineraries_for_user(user_id, updated_since)

    # 2. Fetch profiles (own profile + collaborator profiles)
    own_profile = Accounts.get_profile(user_id)

    collaborator_ids =
      itineraries
      |> Enum.flat_map(fn i -> [i.user_id | i.participants || []] end)
      |> Enum.uniq()
      |> List.delete(user_id)

    collaborator_profiles =
      if Enum.empty?(collaborator_ids) do
        []
      else
        Accounts.list_public_profiles(collaborator_ids)
      end

    profiles =
      ([own_profile] ++ collaborator_profiles)
      |> Enum.filter(& &1)
      |> Enum.uniq_by(& &1.id)

    # 3. Fetch chats
    direct_chats = Chats.list_direct_chats_for_user(user_id, updated_since)
    group_chats = Chats.list_group_chats_for_user(user_id, updated_since)

    # 4. Fetch messages (in any user chats)
    chat_ids = Enum.map(direct_chats ++ group_chats, & &1.id)
    messages =
      if Enum.empty?(chat_ids) do
        []
      else
        Chats.list_messages_for_chats(chat_ids, updated_since)
      end

    # Return response payload
    json(conn, %{
      "changes" => %{
        "itineraries" => %{
          "created" => Enum.map(itineraries, &map_itinerary/1),
          "updated" => [],
          "deleted" => []
        },
        "profiles" => %{
          "created" => Enum.map(profiles, &map_profile/1),
          "updated" => [],
          "deleted" => []
        },
        "direct_chats" => %{
          "created" => Enum.map(direct_chats, &map_direct_chat/1),
          "updated" => [],
          "deleted" => []
        },
        "group_chats" => %{
          "created" => Enum.map(group_chats, &map_group_chat/1),
          "updated" => [],
          "deleted" => []
        },
        "messages" => %{
          "created" => Enum.map(messages, &map_message/1),
          "updated" => [],
          "deleted" => []
        }
      },
      "timestamp" => System.system_time(:millisecond)
    })
  end

  # Helpers to prepare record values from string/int input
  defp prepare_record(record, array_fields, json_fields, date_fields) do
    # Remove metadata fields
    record = Map.drop(record, ["_status", "_changed", "id_attribute"])

    # Parse date fields
    record =
      Enum.reduce(date_fields, record, fn field, acc ->
        case Map.get(acc, field) do
          val when is_integer(val) ->
            case DateTime.from_unix(val, :millisecond) do
              {:ok, dt} -> Map.put(acc, field, dt)
              _ -> Map.delete(acc, field)
            end
          val when is_binary(val) ->
            case Integer.parse(val) do
              {num, ""} ->
                case DateTime.from_unix(num, :millisecond) do
                  {:ok, dt} -> Map.put(acc, field, dt)
                  _ -> Map.delete(acc, field)
                end
              _ ->
                case DateTime.from_iso8601(val) do
                  {:ok, dt, _offset} -> Map.put(acc, field, dt)
                  _ -> Map.delete(acc, field)
                end
            end
          _ ->
            Map.delete(acc, field)
        end
      end)

    # Parse stringified json array fields
    record =
      Enum.reduce(array_fields, record, fn field, acc ->
        case Map.get(acc, field) do
          val when is_binary(val) ->
            case Jason.decode(val) do
              {:ok, decoded} -> Map.put(acc, field, decoded)
              _ -> Map.put(acc, field, [])
            end
          val when is_list(val) ->
            Map.put(acc, field, val)
          _ ->
            Map.put(acc, field, [])
        end
      end)

    # Parse stringified json object fields
    record =
      Enum.reduce(json_fields, record, fn field, acc ->
        case Map.get(acc, field) do
          val when is_binary(val) ->
            case Jason.decode(val) do
              {:ok, decoded} -> Map.put(acc, field, decoded)
              _ -> Map.put(acc, field, nil)
            end
          val when is_map(val) ->
            Map.put(acc, field, val)
          _ ->
            Map.put(acc, field, nil)
        end
      end)

    record
  end

  # deleted_for column name is now consistent between Supabase DB, Ecto, and WatermelonDB
  # No rename shim needed.

  # Upsert helpers using ON CONFLICT in Ecto
  defp upsert_itinerary(record) do
    # Ecto schema types:
    # {:array,:string}  → trip_types, transport_modes, itinerary, participants
    # {:array,:map}     → places_to_visit, checklist, notes
    # :map              → itinerary_map_view
    prepared = prepare_record(record,
      ["trip_types", "transport_modes", "itinerary", "participants", "places_to_visit", "checklist", "notes"],
      ["itinerary_map_view"],
      ["created_at", "updated_at"]
    )

    %Itinerary{id: prepared["id"]}
    |> Itinerary.changeset(prepared)
    |> Repo.insert(on_conflict: :replace_all, conflict_target: :id)
  end

  defp upsert_profile(record) do
    # WatermelonDB maps name/display_name to profiles table name
    prepared = prepare_record(record, [], [], ["created_at", "updated_at"])

    # Extract display_name and use it as name/display_name
    name = prepared["name"] || "Traveler"
    prepared = prepared |> Map.put("name", name) |> Map.put_new("email", "")

    %Profile{id: prepared["id"]}
    |> Profile.changeset(prepared)
    |> Repo.insert(on_conflict: :replace_all, conflict_target: :id)
  end

  defp upsert_direct_chat(record) do
    prepared = prepare_record(record,
      ["participants", "deleted_for"],
      ["participant_details", "last_message", "unread_count", "cleared_at", "typing"],
      ["created_at", "updated_at"]
    )

    %DirectChat{id: prepared["id"]}
    |> DirectChat.changeset(prepared)
    |> Repo.insert(on_conflict: :replace_all, conflict_target: :id)
  end

  defp upsert_group_chat(record) do
    prepared = prepare_record(record,
      ["participants", "admins", "deleted_for"],
      ["participant_details", "last_message", "unread_count", "cleared_at", "typing"],
      ["created_at", "updated_at"]
    )

    %GroupChat{id: prepared["id"]}
    |> GroupChat.changeset(prepared)
    |> Repo.insert(on_conflict: :replace_all, conflict_target: :id)
  end

  defp upsert_message(record) do
    # Ecto schema types:
    # {:array,:string}  → delivered_to, deleted_for, mentions
    # :map              → location, read_by
    # Drop reply_to from mobile push — it's a UUID and we don't sync it back
    prepared = prepare_record(record,
      ["delivered_to", "deleted_for", "mentions"],
      ["location", "read_by"],
      ["created_at", "updated_at", "edited_at", "deleted_for_everyone_at"]
    )
    |> Map.drop(["reply_to"])

    %Message{id: prepared["id"]}
    |> Message.changeset(prepared)
    |> Repo.insert(on_conflict: :replace_all, conflict_target: :id)
  end

  @doc """
  POST /api/sync/push
  Receives a list of changes and applies them to the database using upserts.
  """
  def push(conn, %{"changes" => changes}) do
    # Process each entity list wrapped in a database transaction
    Repo.transaction(fn ->
      # 1. Process profiles
      if changes["profiles"] do
        for r <- changes["profiles"]["created"] ++ changes["profiles"]["updated"] do
          case upsert_profile(r) do
            {:ok, _} -> :ok
            {:error, err} -> Repo.rollback({:profiles, err})
          end
        end
      end

      # 2. Process itineraries
      if changes["itineraries"] do
        for r <- changes["itineraries"]["created"] ++ changes["itineraries"]["updated"] do
          case upsert_itinerary(r) do
            {:ok, _} -> :ok
            {:error, err} -> Repo.rollback({:itineraries, err})
          end
        end
      end

      # 3. Process direct chats
      if changes["direct_chats"] do
        for r <- changes["direct_chats"]["created"] ++ changes["direct_chats"]["updated"] do
          case upsert_direct_chat(r) do
            {:ok, _} -> :ok
            {:error, err} -> Repo.rollback({:direct_chats, err})
          end
        end
      end

      # 4. Process group chats
      if changes["group_chats"] do
        for r <- changes["group_chats"]["created"] ++ changes["group_chats"]["updated"] do
          case upsert_group_chat(r) do
            {:ok, _} -> :ok
            {:error, err} -> Repo.rollback({:group_chats, err})
          end
        end
      end

      # 5. Process messages
      if changes["messages"] do
        for r <- changes["messages"]["created"] ++ changes["messages"]["updated"] do
          case upsert_message(r) do
            {:ok, _} -> :ok
            {:error, err} -> Repo.rollback({:messages, err})
          end
        end
      end
    end)
    |> case do
      {:ok, _} ->
        json(conn, %{success: true})

      {:error, {table, changeset}} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: "Failed to push changes to #{table}", details: inspect(changeset.errors)})
    end
  end
end
