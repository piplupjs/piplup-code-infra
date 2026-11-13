import {useState,useEffect} from "react"
import type {ReactNode} from "react"
type Props = {children:ReactNode,title?:string|undefined,items:Array<{id:number,label:string}>}
export function Card({children,title="Untitled",items}:Props){
const [open,setOpen]=useState(false)
useEffect(()=>{ if(open){document.title=title} },[open,title])
const longCondition = items.length>0&&items.every(item=>item.label.length>3)&&title!=="Untitled"&&open===true
return <section className="card" aria-expanded={open} onClick={()=>setOpen(!open)}>
<h2>{title}</h2>{longCondition?<ul>{items.map(item=><li key={item.id}>{item.label}</li>)}</ul>:null}
{children}</section>
}
export const config = {retries:3,timeout:1000,onError:(error:Error)=>{console.error("Failed",error)},}
