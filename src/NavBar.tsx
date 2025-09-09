import { Burger, Container, Group } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useNavigate, Link } from "react-router-dom";
import { NavLink } from "@mantine/core";
import classes from "./NavBar.module.css";

export function NavBar() {
  const [opened, { toggle }] = useDisclosure(false);
  const navigate = useNavigate();

  const handleGoBack = () => {
    navigate(-1);
  };

  return (
    <header className={classes.header}>
      <Container size="md" className={classes.inner}>
        <Group gap={5} visibleFrom="xs">
          {/* Back Button */}
          <div className={classes.link}>
            <NavLink label="Go Back" onClick={handleGoBack} />
          </div>

          {/* Home NavLink */}
          <div className={classes.link}>
            <NavLink
              className={classes.link}
              component={Link}
              to="/"
              label="Home"
            />
          </div>
        </Group>

        <Burger opened={opened} onClick={toggle} hiddenFrom="xs" size="sm" />
      </Container>
    </header>
  );
}
