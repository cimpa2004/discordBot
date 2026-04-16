import {
  Alert,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { useMemo, useState } from "react";
import DeleteSoundDialog from "../components/DeleteSoundDialog";
import { useDeleteSound, useGuildSounds } from "../hooks/useGuildSounds";

function formatDate(dateString) {
  if (!dateString) {
    return "-";
  }
  return new Date(dateString).toLocaleString();
}

export default function SoundListPage({ guildId }) {
  const [filter, setFilter] = useState("");
  const [soundToDelete, setSoundToDelete] = useState(null);
  const isAllMode = !guildId;
  const { data, isLoading, error } = useGuildSounds(guildId);
  const deleteMutation = useDeleteSound(guildId);

  const filtered = useMemo(() => {
    const normalized = filter.trim().toLowerCase();
    const sounds = data || [];
    if (!normalized) {
      return sounds;
    }
    return sounds.filter((s) => s.name.toLowerCase().includes(normalized));
  }, [data, filter]);

  const onDeleteConfirm = async () => {
    if (!soundToDelete) {
      return;
    }

    await deleteMutation.mutateAsync({
      soundId: soundToDelete.id,
      guildId: String(soundToDelete.guild_id),
    });

    setSoundToDelete(null);
  };

  return (
    <Paper
      elevation={0}
      sx={{ p: 3, border: (theme) => `1px solid ${theme.palette.divider}`, borderRadius: 3 }}
    >
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, flexGrow: 1 }}>
          {isAllMode ? "All Sounds" : "Sounds in Server"}
        </Typography>
        <TextField
          size="small"
          label="Search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </Stack>

      {error && <Alert severity="error">{error.response?.data?.error || error.message}</Alert>}
      {deleteMutation.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {deleteMutation.error.response?.data?.error || deleteMutation.error.message}
        </Alert>
      )}

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              {isAllMode && <TableCell>Server</TableCell>}
              <TableCell>Description</TableCell>
              <TableCell>Created</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={isAllMode ? 5 : 4}>Loading sounds...</TableCell>
              </TableRow>
            )}
            {!isLoading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={isAllMode ? 5 : 4}>No sounds found.</TableCell>
              </TableRow>
            )}
            {filtered.map((sound) => (
              <TableRow key={sound.id} hover>
                <TableCell sx={{ fontWeight: 700 }}>{sound.name}</TableCell>
                {isAllMode && <TableCell>{sound.guild_name || sound.guild_id}</TableCell>}
                <TableCell>{sound.description || "-"}</TableCell>
                <TableCell>{formatDate(sound.created_at)}</TableCell>
                <TableCell align="right">
                  <IconButton
                    color="error"
                    onClick={() => setSoundToDelete(sound)}
                    aria-label={`Delete ${sound.name}`}
                    disabled={deleteMutation.isPending}
                  >
                    X
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <DeleteSoundDialog
        open={Boolean(soundToDelete)}
        soundName={soundToDelete?.name}
        isPending={deleteMutation.isPending}
        onCancel={() => setSoundToDelete(null)}
        onConfirm={onDeleteConfirm}
      />
    </Paper>
  );
}
