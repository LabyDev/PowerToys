import { Container, Title, Button, Group, Card } from "@mantine/core";
import {
  ShuffleIcon,
  SortAscendingIcon,
  GearSixIcon,
} from "@phosphor-icons/react";
import { NavLink } from "react-router";
import "./MainPage.css";

function App() {
  return (
    <Container size="xs" style={{ textAlign: "center" }} className="container">
      <Title order={1}>PowerToys</Title>
      <Group justify="center" mt="xl">
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Button
            fullWidth
            component={NavLink}
            to="/FileRandomiser"
            leftSection={<ShuffleIcon />}
          >
            File Randomiser
          </Button>
        </Card>
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Button
            fullWidth
            component={NavLink}
            to="/sorter"
            leftSection={<SortAscendingIcon />}
          >
            File Sorter
          </Button>
        </Card>
      </Group>
      <Button
        mt="xl"
        variant="subtle"
        component={NavLink}
        to="/settings"
        leftSection={<GearSixIcon />}
        style={{ alignSelf: "center" }}
      >
        Settings
      </Button>
    </Container>
  );
}

export default App;
