' Chama agendado.ps1 sem abrir janela (o Agendador de Tarefas roda isto a cada 5 minutos).
' Espera o script terminar: assim a tarefa fica "em execução" e o Agendador não começa outra rodada por cima.
Set fso = CreateObject("Scripting.FileSystemObject")
pasta = fso.GetParentFolderName(WScript.ScriptFullName)
codigo = CreateObject("WScript.Shell").Run("powershell.exe -NoProfile -ExecutionPolicy Bypass -File """ & pasta & "\agendado.ps1""", 0, True)
WScript.Quit codigo
