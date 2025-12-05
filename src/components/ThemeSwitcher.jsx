import React, { useState } from 'react';
import { IconButton, Tooltip, Menu, MenuItem } from '@mui/material';
import { Brightness4, Brightness7, Palette } from '@mui/icons-material';

export default function ThemeSwitcher({ currentTheme, onThemeChange }) {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const themes = [
    { value: 'light', label: 'Light' },
    { value: 'paper', label: 'Paper' },
    { value: 'dark', label: 'Dark' },
    { value: 'purple', label: 'Purple' },
    { value: 'dracula', label: 'Dracula' },
    { value: 'onedark', label: 'One Dark Pro' },
    { value: 'monokai', label: 'Monokai Pro' },
    { value: 'solarized', label: 'Solarized Dark' },
    { value: 'nord', label: 'Nord' },
    { value: 'github', label: 'GitHub Dark' },
    { value: 'dos', label: 'DOS Edit' },
    { value: 'green', label: 'Green Screen' },
  ];

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleThemeSelect = (theme) => {
    onThemeChange(theme);
    document.documentElement.setAttribute('data-theme', theme);
    handleClose();
  };

  return (
    <>
      <Tooltip title="Change Theme">
        <IconButton
          onClick={handleClick}
          size="small"
          sx={{ color: 'text.primary' }}
        >
          <Palette />
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        {themes.map((theme) => (
          <MenuItem
            key={theme.value}
            selected={currentTheme === theme.value}
            onClick={() => handleThemeSelect(theme.value)}
          >
            {theme.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
