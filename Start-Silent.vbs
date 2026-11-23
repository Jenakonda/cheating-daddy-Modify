Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
rootDir = fso.GetParentFolderName(WScript.ScriptFullName)
electronExe = fso.BuildPath(rootDir, "node_modules\electron\dist\electron.exe")

If Not fso.FileExists(electronExe) Then
    MsgBox "Electron binary not found. Run 'npm install' in " & rootDir & " first.", vbExclamation, "Cheating Daddy"
    WScript.Quit 1
End If

shell.CurrentDirectory = rootDir
On Error Resume Next
shell.Environment("Process").Remove "ELECTRON_RUN_AS_NODE"
On Error GoTo 0
shell.Run """" & electronExe & """ .", 0, False
