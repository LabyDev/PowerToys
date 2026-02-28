import { Card, Flex, Image, Button, Stack, Text } from "@mantine/core";
import {
  ShuffleIcon,
  SortAscendingIcon,
  GearSixIcon,
} from "@phosphor-icons/react";
import { NavLink } from "react-router";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { platform, Platform } from "@tauri-apps/plugin-os";
import "./MainPage.css";

function App() {
  const { t } = useTranslation();
  const [isLinux, setIsLinux] = useState(false);

  useEffect(() => {
    async function detectOS() {
      try {
        const currentPlatform: Platform = await platform();
        setIsLinux(currentPlatform === "linux");
      } catch (err) {
        console.error("Failed to detect platform:", err);
      }
    }

    detectOS();
  }, []);

  return (
    <div className="wrapper">
      <Card
        shadow="lg"
        padding="xl"
        radius="md"
        withBorder
        className="main-card"
      >
        <Flex justify="center" mb="xl">
          {isLinux ? (
            <Text size="xl" fw={700}>
              Laby&apos;s Powertoys
            </Text>
          ) : (
            <Image
              src="/powertoys.svg"
              alt="Laby's Powertoys Logo"
              w={200}
              fit="contain"
            />
          )}
        </Flex>

        <Stack gap="md" style={{ width: "100%" }}>
          <Button
            fullWidth
            component={NavLink}
            to="/FileRandomiser"
            leftSection={<ShuffleIcon />}
          >
            {t("mainPage.fileRandomiserButton")}
          </Button>

          <Button
            fullWidth
            component={NavLink}
            to="/FileSorter"
            leftSection={<SortAscendingIcon />}
          >
            {t("mainPage.fileSorterButton")}
          </Button>

          <Button
            variant="subtle"
            component={NavLink}
            to="/Settings"
            leftSection={<GearSixIcon />}
          >
            {t("mainPage.settingsButton")}
          </Button>
        </Stack>
      </Card>
    </div>
  );
}

export default App;
