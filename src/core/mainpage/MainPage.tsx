import { Card, Title, Button, Stack, useMantineTheme } from "@mantine/core";
import {
  ShuffleIcon,
  SortAscendingIcon,
  GearSixIcon,
} from "@phosphor-icons/react";
import { NavLink } from "react-router";
import "./MainPage.css";

function App() {
  const theme = useMantineTheme();

  return (
    <div className="wrapper">
      <Card
        shadow="lg"
        padding="xl"
        radius="md"
        withBorder
        className="main-card"
      >
        <Title
          style={{ textAlign: "center", marginBottom: theme.spacing.xl }}
          order={1}
        >
          PowerToys
        </Title>

        <Stack gap="md" style={{ width: "100%" }}>
          <Button
            fullWidth
            component={NavLink}
            to="/FileRandomiser"
            leftSection={<ShuffleIcon />}
          >
            File Randomiser
          </Button>

          <Button
            fullWidth
            component={NavLink}
            to="/sorter"
            leftSection={<SortAscendingIcon />}
          >
            File Sorter
          </Button>

          <Button
            variant="subtle"
            component={NavLink}
            to="/Settings"
            leftSection={<GearSixIcon />}
          >
            Settings
          </Button>
        </Stack>
      </Card>
    </div>
  );
}

export default App;
