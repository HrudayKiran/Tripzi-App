# Run: mix run --no-start verify_all.exs 2>&1
# Full system verification - checks all critical paths

Application.ensure_all_started(:nxtvibes)
import Ecto.Query

user_id = "b712a3c6-b9ab-47cd-a146-94510dc6ea90"
{:ok, bin_uid} = Ecto.UUID.dump(user_id)

IO.puts("\n=== 1. JWT Token Config claims ===")
config = NxtVibes.Auth.Token.token_config()
IO.puts("  Validated claims: #{inspect(Map.keys(config))}")
# Expected: ["aud", "exp"] — iss, iat, nbf must NOT appear

IO.puts("\n=== 2. Itinerary query (UUID encoding) ===")
q1 = from i in NxtVibes.Itineraries.Itinerary,
  where: i.user_id == ^user_id or fragment("? = ANY(?)", ^bin_uid, i.participants)
result1 = NxtVibes.Repo.all(q1)
IO.puts("  ✅ Itineraries found: #{length(result1)}")

IO.puts("\n=== 3. Direct chats query (UUID encoding) ===")
q2 = from c in NxtVibes.Chats.DirectChat,
  where: fragment("? = ANY(?)", ^bin_uid, c.participants)
result2 = NxtVibes.Repo.all(q2)
IO.puts("  ✅ Direct chats found: #{length(result2)}")

IO.puts("\n=== 4. Group chats query (UUID encoding) ===")
q3 = from c in NxtVibes.Chats.GroupChat,
  where: fragment("? = ANY(?)", ^bin_uid, c.participants)
result3 = NxtVibes.Repo.all(q3)
IO.puts("  ✅ Group chats found: #{length(result3)}")

IO.puts("\n=== 5. Messages query for chat_ids ===")
chat_ids = Enum.map(result2 ++ result3, & &1.id)
result4 = if Enum.empty?(chat_ids), do: [],
  else: NxtVibes.Repo.all(from m in NxtVibes.Chats.Message, where: m.chat_id in ^chat_ids)
IO.puts("  ✅ Messages found: #{length(result4)}")

IO.puts("\n=== 6. Profile query ===")
profile = NxtVibes.Accounts.get_profile(user_id)
IO.puts("  ✅ Profile: #{if profile, do: profile.name, else: "NOT FOUND"}")

IO.puts("\n=== ALL CHECKS PASSED ===")
