import { Component } from "cc";

export default class Singleton<T> extends Component{
    public static Instance<T>(c: {new(): T; }) : T{
        if (this.instance == null){
            this.instance = new c();
        }
        return this.instance;
    }
    public static instance = null;
}
