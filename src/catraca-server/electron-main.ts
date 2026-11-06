import { app, BrowserWindow, Menu, Tray, nativeImage, shell } from 'electron';
import path from 'path';
import fs from 'fs';

// 1. Garantir que apenas UMA instância do servidor execute por vez
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // Já existe uma instância rodando, encerra a nova imediatamente
  app.quit();
  process.exit(0);
}

// 2. Configurar caminho persistente para o config.json no userData do usuário
const userDataDir = app.getPath('userData');
const targetConfigPath = path.join(userDataDir, 'config.json');
process.env.APP_CONFIG_PATH = targetConfigPath;

try {
  // Se ainda não existir config.json no diretório userData, tenta copiar do app root / resources
  if (!fs.existsSync(targetConfigPath)) {
    const candidateConfigs = [
      path.join(process.cwd(), 'config.json'),
      path.join(process.resourcesPath, 'config.json'),
      path.join(__dirname, '..', 'config.json'),
      path.join(__dirname, 'config.json')
    ];
    for (const cand of candidateConfigs) {
      if (fs.existsSync(cand)) {
        fs.copyFileSync(cand, targetConfigPath);
        break;
      }
    }
  }
} catch (err) {
  console.error('[Electron] Erro ao sincronizar config.json:', err);
}

// 3. Inicializar o servidor Express + WebSocket da catraca
import './index';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

// Verifica se foi iniciado automaticamente pelo Windows no boot
const isAutoStart = process.argv.includes('--autostart') || process.argv.includes('--hidden');

function getIconPath(): string {
  const possiblePaths = [
    path.join(__dirname, '..', 'public', 'favicon.ico'),
    path.join(__dirname, 'public', 'favicon.ico'),
    path.join(process.resourcesPath, 'public', 'favicon.ico'),
    path.join(process.resourcesPath, 'favicon.ico'),
    path.join(process.cwd(), 'public', 'favicon.ico'),
    path.join(process.cwd(), 'favicon.ico')
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return '';
}

function configureAutoStart(enable: boolean) {
  try {
    app.setLoginItemSettings({
      openAtLogin: enable,
      openAsHidden: true,
      path: process.execPath,
      args: ['--autostart']
    });
  } catch (err) {
    console.error('[Electron] Erro ao configurar login automático:', err);
  }
}

function updateTrayMenu() {
  if (!tray) return;

  const loginSettings = app.getLoginItemSettings();

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Thor BJJ Flow - Catraca',
      enabled: false
    },
    {
      label: 'Status: Servidor Ativo (Porta 3001)',
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'Abrir Painel',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      }
    },
    {
      label: 'Abrir no Navegador',
      click: () => {
        shell.openExternal('http://localhost:3001/config');
      }
    },
    { type: 'separator' },
    {
      label: 'Iniciar com o Windows',
      type: 'checkbox',
      checked: loginSettings.openAtLogin,
      click: (item) => {
        configureAutoStart(item.checked);
      }
    },
    { type: 'separator' },
    {
      label: 'Sair do Servidor',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
}

function createTray() {
  if (tray) return;

  const iconPath = getIconPath();
  const icon = iconPath ? nativeImage.createFromPath(iconPath) : nativeImage.createEmpty();

  tray = new Tray(icon);
  tray.setToolTip('Thor BJJ Flow - Servidor da Catraca (Online)');

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    } else {
      createWindow();
    }
  });

  tray.on('click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    } else {
      createWindow();
    }
  });

  updateTrayMenu();
}

function createWindow() {
  const iconPath = getIconPath();

  mainWindow = new BrowserWindow({
    width: 950,
    height: 720,
    title: 'Thor BJJ Flow - Servidor Catraca',
    icon: iconPath || undefined,
    autoHideMenuBar: true,
    show: !isAutoStart, // Se for autostart no boot, não mostra a janela de imediato
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Carrega a tela de login/configuração servida pelo Express local
  mainWindow.loadURL('http://localhost:3001/login');

  // Ao clicar no 'X', não fecha o processo para manter a catraca online
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      if (mainWindow) {
        mainWindow.hide();
      }
      if (tray && tray.displayBalloon) {
        tray.displayBalloon({
          title: 'Thor BJJ Catraca',
          content: 'O servidor continua rodando em segundo plano junto ao relógio para não interromper a catraca.'
        });
      }
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Quando uma segunda instância tenta abrir (ex: usuário clica no atalho da Área de Trabalho)
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  } else {
    createWindow();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.whenReady().then(() => {
  // Configura inicialização com o Windows por padrão se ainda não configurado
  const currentLogin = app.getLoginItemSettings();
  if (!currentLogin.openAtLogin) {
    configureAutoStart(true);
  }

  createTray();
  createWindow();

  app.on('activate', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    } else {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // No Windows, não encerra o aplicativo ao fechar todas as janelas;
  // mantém o tray e o servidor HTTP/WS rodando para a catraca
});
