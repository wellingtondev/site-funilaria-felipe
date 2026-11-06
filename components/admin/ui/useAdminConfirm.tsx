"use client";
import { useState } from "react";
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from "@mui/material";
export function useAdminConfirm() {
  const [request,setRequest]=useState<{message:string;resolve:(confirmed:boolean)=>void}|null>(null);
  const confirm=(message:string)=>new Promise<boolean>(resolve=>setRequest({message,resolve}));
  function finish(value:boolean){request?.resolve(value);setRequest(null);}
  const dialog=<Dialog open={!!request} onClose={()=>finish(false)} maxWidth="xs" fullWidth aria-labelledby="confirm-action-title"><DialogTitle id="confirm-action-title">Confirmar ação</DialogTitle><DialogContent><DialogContentText>{request?.message}</DialogContentText></DialogContent><DialogActions sx={{p:2,gap:1}}><Button autoFocus onClick={()=>finish(false)}>Cancelar</Button><Button variant="contained" onClick={()=>finish(true)}>Confirmar</Button></DialogActions></Dialog>;
  return [confirm,dialog] as const;
}
