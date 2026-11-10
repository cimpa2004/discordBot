import {
  Autocomplete,
  AppBar,
  Avatar,
  Box,
  Button,
  Container,
  Stack,
  TextField,
  Toolbar,
  Typography,
} from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function Layout({ guildId, onGuildChange, children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const guildOptions = [
    { id: "0", name: "Global sounds" },
    ...((user?.guilds || []).map((g) => ({ id: String(g.id), name: g.name }))),
  ];
  const selectedGuild = guildOptions.find((g) => g.id === String(guildId)) || null;

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar
        position="sticky"
        elevation={0}
        color="transparent"
        sx={{
          borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
          backdropFilter: "blur(8px)",
          backgroundColor: "rgba(43, 45, 49, 0.72)",
        }}
      >
        <Toolbar sx={{ gap: 2, py: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: 0.4 }}>
            Soundboard Control
          </Typography>

          <Stack direction="row" spacing={1} sx={{ ml: 2 }}>
            <Button
              onClick={() => navigate("/sounds")}
              variant={location.pathname === "/sounds" ? "contained" : "outlined"}
            >
              Sounds
            </Button>
            <Button
              onClick={() => navigate("/upload")}
              variant={location.pathname === "/upload" ? "contained" : "outlined"}
            >
              Upload
            </Button>
          </Stack>

          <Box sx={{ flexGrow: 1 }} />

          <Autocomplete
            size="small"
            options={guildOptions}
            value={selectedGuild}
            onChange={(_event, option) => onGuildChange(option?.id || "")}
            getOptionLabel={(option) => option.name}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            sx={{ minWidth: 280 }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Server"
                placeholder="Search server"
                sx={{ backgroundColor: "background.paper" }}
              />
            )}
          />

          <Stack direction="row" spacing={1} alignItems="center">
            <Avatar
              src={user?.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : undefined}
              alt={user?.username || "User"}
            />
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {user?.username}
            </Typography>
          </Stack>

          <Button color="inherit" onClick={logout}>
            Logout
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: 4 }}>
        {children}
      </Container>
    </Box>
  );
}
