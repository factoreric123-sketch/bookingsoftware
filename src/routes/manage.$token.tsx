import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, Check, Clock3, MapPin, ShieldCheck, X } from "lucide-react";
import { availableSlots, useAppStore } from "../lib/app-store";

export const Route = createFileRoute("/manage/$token")({ component: ManageBooking });

function ManageBooking() {
  const { token } = Route.useParams();
  const { workspace, rescheduleAppointment, updateAppointment } = useAppStore();
  const appointment = workspace.appointments.find((item) => item.manageToken === token);
  const [mode, setMode] = useState<"view" | "reschedule" | "cancel" | "done">("view");
  const [date, setDate] = useState(appointment?.date ?? "");
  const [time, setTime] = useState(appointment?.time ?? "");
  const [error, setError] = useState("");
  const dates = useMemo(() => Array.from({length:14},(_,index)=>{const day=new Date();day.setDate(day.getDate()+index);return day.toISOString().slice(0,10)}),[]);

  if (!appointment) return <div className="manage-page"><main className="manage-card invalid-token"><ShieldCheck size={34}/><h1>This link is invalid or expired.</h1><p>For privacy, booking details are only available through a valid management link.</p><Link to="/">Return home</Link></main></div>;
  const service = workspace.services.find((item) => item.id === appointment.serviceId);
  const customer = workspace.customers.find((item) => item.id === appointment.customerId);
  const slots = date && service ? availableSlots(workspace, service.id, date, appointment.id) : [];
  const reschedule = () => { const result = rescheduleAppointment(appointment.id,date,time); if(result.error)setError(result.error);else setMode("done"); };
  const cancel = () => { updateAppointment(appointment.id,{status:"cancelled"}); setMode("done"); };

  return <div className="manage-page"><header><span style={{background:workspace.business.accent}}>{workspace.business.name.charAt(0)}</span><div><b>{workspace.business.name}</b><small>Booking management</small></div></header><main className="manage-card" style={{"--manage-accent":workspace.business.accent} as React.CSSProperties}>{mode==="view"&&<><span className={`manage-status ${appointment.status}`}>{appointment.status}</span><h1>Hi {customer?.name.split(" ")[0]}, here’s your appointment.</h1><p>Use this private link to reschedule or cancel without creating an account.</p><div className="manage-details"><div><CalendarDays size={19}/><span><b>{formatDate(appointment.date)}</b><small>{prettyTime(appointment.time)}</small></span></div><div><Clock3 size={19}/><span><b>{service?.name}</b><small>{appointment.duration} minutes · ${service?.price}</small></span></div><div><MapPin size={19}/><span><b>{workspace.business.address}</b><small>{workspace.business.timezone}</small></span></div></div>{appointment.status!=="cancelled"?<div className="manage-actions"><button onClick={()=>setMode("reschedule")}>Reschedule appointment</button><button className="cancel-action" onClick={()=>setMode("cancel")}>Cancel appointment</button></div>:<div className="cancelled-note"><X size={16}/>This appointment is cancelled and its time is available again.</div>}</>}{mode==="reschedule"&&<><button className="booking-back" onClick={()=>setMode("view")}><ArrowLeft size={15}/>Appointment details</button><span className="manage-kicker">RESCHEDULE</span><h1>Choose a new time.</h1><p>Your original time remains reserved until you confirm a new one.</p><div className="date-strip">{dates.slice(0,7).map(item=><button className={date===item?"selected":""} onClick={()=>{setDate(item);setTime("")}} key={item}><small>{new Date(`${item}T12:00:00`).toLocaleDateString("en-US",{weekday:"short"})}</small><b>{new Date(`${item}T12:00:00`).getDate()}</b><span>{new Date(`${item}T12:00:00`).toLocaleDateString("en-US",{month:"short"})}</span></button>)}</div>{date&&<div className="slot-grid">{slots.map(slot=><button className={time===slot?"selected":""} onClick={()=>setTime(slot)} key={slot}>{prettyTime(slot)}</button>)}</div>}{error&&<div className="booking-error">{error}</div>}<button className="manage-primary" disabled={!time} onClick={reschedule}>Confirm new time</button></>}{mode==="cancel"&&<div className="cancel-confirm"><span><X size={23}/></span><h1>Cancel this appointment?</h1><p>This will immediately release {formatDate(appointment.date)} at {prettyTime(appointment.time)} for another customer.</p><button className="danger-button" onClick={cancel}>Yes, cancel appointment</button><button onClick={()=>setMode("view")}>Keep my appointment</button></div>}{mode==="done"&&<div className="manage-success"><span><Check size={27}/></span><small>{appointment.status==="cancelled"?"APPOINTMENT CANCELLED":"APPOINTMENT UPDATED"}</small><h1>{appointment.status==="cancelled"?"Your appointment was cancelled.":"Your new time is confirmed."}</h1><p>{appointment.status==="cancelled"?"The time has been released back into availability.":`${formatDate(appointment.date)} at ${prettyTime(appointment.time)}`}</p><button onClick={()=>setMode("view")}>View appointment</button></div>}</main><footer><ShieldCheck size={13}/>This private link contains access to one appointment only.</footer></div>;
}
const prettyTime=(value:string)=>new Date(`2026-01-01T${value}:00`).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"});
const formatDate=(value:string)=>new Date(`${value}T12:00:00`).toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"});
