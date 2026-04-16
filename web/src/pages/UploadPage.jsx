import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Box, Button, Paper, Stack, TextField, Typography } from "@mui/material";
import { useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { useUploadSound } from "../hooks/useGuildSounds";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const schema = z.object({
  soundName: z
    .string()
    .min(1, "Sound name is required")
    .max(50, "Sound name must be 50 characters or less")
    .regex(/^[a-zA-Z0-9 _-]+$/, "Only letters, numbers, spaces, _ and - are allowed"),
  description: z.string().max(200, "Description must be 200 characters or less").optional(),
  file: z
    .instanceof(File, { message: "MP3 file is required" })
    .refine((f) => ["audio/mpeg", "audio/mp3"].includes(f.type), "Only MP3 files are allowed")
    .refine((f) => f.size <= MAX_FILE_SIZE, "File size must be less than 10MB"),
});

export default function UploadPage({ guildId }) {
  const uploadMutation = useUploadSound(guildId);

  const {
    handleSubmit,
    control,
    formState: { errors },
    reset,
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      soundName: "",
      description: "",
      file: undefined,
    },
  });

  const uploadError = useMemo(
    () => uploadMutation.error?.response?.data?.error || uploadMutation.error?.message,
    [uploadMutation.error],
  );

  const onSubmit = async (values) => {
    const formData = new FormData();
    formData.append("soundName", values.soundName.trim());
    formData.append("description", values.description || "");
    formData.append("file", values.file);

    await uploadMutation.mutateAsync(formData);
    reset();
  };

  return (
    <Paper
      elevation={0}
      sx={{ p: 3, border: (theme) => `1px solid ${theme.palette.divider}`, borderRadius: 3 }}
    >
      <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>
        Upload Sound
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Selected server ID: {guildId || "None"}
      </Typography>

      <Stack component="form" spacing={2} onSubmit={handleSubmit(onSubmit)}>
        <Controller
          control={control}
          name="soundName"
          render={({ field }) => (
            <TextField
              {...field}
              label="Sound name"
              error={Boolean(errors.soundName)}
              helperText={errors.soundName?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="description"
          render={({ field }) => (
            <TextField
              {...field}
              label="Description"
              multiline
              minRows={2}
              error={Boolean(errors.description)}
              helperText={errors.description?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="file"
          render={({ field: { onChange } }) => (
            <Box>
              <Button variant="outlined" component="label">
                Choose MP3 file
                <input
                  hidden
                  type="file"
                  accept="audio/mp3,audio/mpeg"
                  onChange={(e) => onChange(e.target.files?.[0])}
                />
              </Button>
              {errors.file && (
                <Typography color="error" variant="body2" sx={{ mt: 1 }}>
                  {errors.file.message}
                </Typography>
              )}
            </Box>
          )}
        />

        {uploadError && <Alert severity="error">{uploadError}</Alert>}
        {uploadMutation.isSuccess && <Alert severity="success">Sound uploaded successfully.</Alert>}

        <Button disabled={!guildId || uploadMutation.isPending} type="submit" variant="contained" size="large">
          {uploadMutation.isPending ? "Uploading..." : "Upload"}
        </Button>
      </Stack>
    </Paper>
  );
}
