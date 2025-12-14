import { Burger, Container, Group, Button } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useNavigate, Link } from "react-router-dom";
import { NavLink } from "@mantine/core";
import { CaretLeftIcon } from "@phosphor-icons/react";
import classes from "./NavBar.module.css";

export function NavBar() {
  const [opened, { toggle }] = useDisclosure(false);
  const navigate = useNavigate();

  const handleGoBack = () => {
    navigate(-1);
  };

  return (
    <header className={classes.header}>
      <Container fluid className={classes.inner}>
        <Group gap="sm" visibleFrom="xs" className={classes["no-wrap-group"]}>
          {/* Back Button with an icon */}
          <Button
            variant="subtle"
            leftSection={<CaretLeftIcon size={20} weight="bold" />}
            onClick={handleGoBack}
          >
            Go Back
          </Button>

          {/* Home NavLink */}
          <NavLink
            className={classes.link}
            component={Link}
            to="/"
            label="Home"
            active
          />
        </Group>

        <Burger opened={opened} onClick={toggle} hiddenFrom="xs" size="sm" />
      </Container>
    </header>
  );
}
