import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../api/client";

export function useGuildSounds(guildId) {
  return useQuery({
    queryKey: ["guild-sounds", guildId || "all"],
    queryFn: async () => {
      const endpoint = guildId ? `/guilds/${guildId}/sounds` : "/guilds/sounds/all";
      const { data } = await apiClient.get(endpoint);
      return data;
    },
    enabled: true,
  });
}

export function useUploadSound(guildId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formData) => {
      const { data } = await apiClient.post(`/guilds/${guildId}/sounds`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guild-sounds", guildId] });
    },
  });
}

export function useDeleteSound(guildId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ soundId, guildId: soundGuildId }) => {
      const targetGuildId = soundGuildId || guildId;

      if (!targetGuildId) {
        throw new Error("Cannot delete sound without guild context");
      }

      const { data } = await apiClient.delete(`/guilds/${targetGuildId}/sounds/${soundId}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guild-sounds"] });
    },
  });
}
