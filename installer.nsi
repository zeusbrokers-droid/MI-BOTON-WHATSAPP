Unicode True
Name "Leslie Car Agent"
OutFile "release/Leslie-Car-Agent-Setup.exe"
InstallDir "$LOCALAPPDATA\Programs\Leslie Car Agent"
RequestExecutionLevel user
SetCompressor /SOLID lzma
Icon "app-icon.ico"
UninstallIcon "app-icon.ico"
BrandingText "Leslie Car Miami · Powered by Zeus Brokers"

Page instfiles
UninstPage uninstConfirm
UninstPage instfiles

Section "Instalar"
  SetOutPath "$INSTDIR"
  File /r "release/win-unpacked/*.*"
  File "app-icon.ico"
  WriteUninstaller "$INSTDIR\Desinstalar Leslie Car Agent.exe"

  CreateDirectory "$SMPROGRAMS\Leslie Car Agent"
  CreateShortcut "$SMPROGRAMS\Leslie Car Agent\Leslie Car Agent.lnk" "$INSTDIR\Leslie Car Agent.exe" "" "$INSTDIR\app-icon.ico"
  CreateShortcut "$SMPROGRAMS\Leslie Car Agent\Desinstalar.lnk" "$INSTDIR\Desinstalar Leslie Car Agent.exe"
  CreateShortcut "$DESKTOP\Leslie Car Agent.lnk" "$INSTDIR\Leslie Car Agent.exe" "" "$INSTDIR\app-icon.ico"

  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\LeslieCarAgent" "DisplayName" "Leslie Car Agent"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\LeslieCarAgent" "DisplayIcon" "$INSTDIR\app-icon.ico"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\LeslieCarAgent" "UninstallString" '"$INSTDIR\Desinstalar Leslie Car Agent.exe"'
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\LeslieCarAgent" "Publisher" "Zeus Brokers"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\LeslieCarAgent" "DisplayVersion" "1.2.0"

  Exec "$INSTDIR\Leslie Car Agent.exe"
SectionEnd

Section "Uninstall"
  Delete "$DESKTOP\Leslie Car Agent.lnk"
  Delete "$SMPROGRAMS\Leslie Car Agent\Leslie Car Agent.lnk"
  Delete "$SMPROGRAMS\Leslie Car Agent\Desinstalar.lnk"
  RMDir "$SMPROGRAMS\Leslie Car Agent"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\LeslieCarAgent"
  RMDir /r "$INSTDIR"
SectionEnd
