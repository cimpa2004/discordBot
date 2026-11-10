import { Box, Button, Paper, Stack, Typography } from "@mui/material";
import { useAuth } from "../hooks/useAuth";

export default function LoginPage() {
  const { login } = useAuth();

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        bgcolor: "background.default",
      }}
    >
      <Paper
        elevation={0}
        sx={{
          p: 5,
          border: (theme) => `1px solid ${theme.palette.divider}`,
          backgroundColor: "background.paper",
          borderRadius: 4,
          maxWidth: 520,
        }}
      >
        <Stack spacing={2}>
          <Typography variant="h3" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
            Run the soundboard like a studio.
          </Typography>
          <Typography color="text.secondary">
            Sign in with Discord to pick a server and upload custom sounds your bot can play instantly.
          </Typography>
          <Button size="large" variant="contained" onClick={login}>
            Continue with Discord
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
