import { Box, Typography } from "@mui/material";

export default function Sidebar() {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Typography
        variant="subtitle2"
        sx={{
          textTransform: "uppercase",
          letterSpacing: 0.12,
          color: "grey.400",
          mb: 1
        }}
      >
        Navigator
      </Typography>
      <Box
        sx={{
          flex: 1,
          fontSize: 12,
          color: "grey.500",
          display: "flex",
          alignItems: "flex-start"
        }}
      >
        {/* Intentionally blank for now */}
        (Sidebar reserved for future content)
      </Box>
    </Box>
  );
}
