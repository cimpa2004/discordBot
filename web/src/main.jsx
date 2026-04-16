import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext";

const queryClient = new QueryClient();

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#5865F2",
    },
    secondary: {
      main: "#57F287",
    },
    background: {
      default: "#313338",
      paper: "#2B2D31",
    },
    text: {
      primary: "#F2F3F5",
      secondary: "#B5BAC1",
    },
  },
  typography: {
    fontFamily: "'Segoe UI', sans-serif",
    h4: {
      letterSpacing: -0.8,
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarWidth: "thin",
          scrollbarColor: "#1E1F22 #2B2D31",
        },
        "*::-webkit-scrollbar": {
          width: "10px",
          height: "10px",
        },
        "*::-webkit-scrollbar-track": {
          background: "#2B2D31",
        },
        "*::-webkit-scrollbar-thumb": {
          backgroundColor: "#1E1F22",
          borderRadius: "10px",
          border: "2px solid #2B2D31",
        },
        "*::-webkit-scrollbar-thumb:hover": {
          backgroundColor: "#111214",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        containedPrimary: {
          backgroundColor: "#5865F2",
        },
      },
    },
  },
});

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
);
