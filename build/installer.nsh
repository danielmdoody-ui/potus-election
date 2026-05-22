!macro customInstall
  ; Auto-import model when installer and model are shipped together.
  ; Place phi3-mini-q4.gguf in the same folder as Setup.exe.
  IfFileExists "$EXEDIR\phi3-mini-q4.gguf" 0 done
    CreateDirectory "$APPDATA\${PRODUCT_FILENAME}\models"
    CopyFiles /SILENT "$EXEDIR\phi3-mini-q4.gguf" "$APPDATA\${PRODUCT_FILENAME}\models\phi3-mini-q4.gguf"
    CreateDirectory "$APPDATA\${APP_PACKAGE_NAME}\models"
    CopyFiles /SILENT "$EXEDIR\phi3-mini-q4.gguf" "$APPDATA\${APP_PACKAGE_NAME}\models\phi3-mini-q4.gguf"
  done:
!macroend
