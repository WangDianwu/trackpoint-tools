import tp from '../index.js'
import isFunction from 'lodash/isFunction'

describe('trackpoint nop', function () {
    it ('should be a function', function () {
        const nop = tp.nop
        expect(isFunction(nop)).toBe(true)
    })

    it ('should work well', function () {
        const nop = tp.nop
        expect(nop).not.toThrow()
    })
})

describe('trackpoint before', function () {
    let soldier
    let pushSoldier

    beforeEach(function () {
        soldier = []
        pushSoldier = n => () => soldier.push(n)
    })
    it ('should curryable', function () {
        expect(isFunction(tp.before(tp.nop))).toBe(true)
    })

    it ('should trackFn eval before fn', function () {
        tp.before(pushSoldier('trackFn'), pushSoldier('fn'))()
        expect(soldier).toEqual(['trackFn', 'fn'])
    })

    it ('should ignore trackFn throw', function () {
        const beforeFn = tp.before(() => {throw new Error('stub throw')}, pushSoldier('fn'))
        expect(beforeFn).not.toThrow()
        expect(soldier).toEqual(['fn'])
    })
})

describe('trackpoint after', function () {
    let soldier
    let pushSoldier
    beforeEach(function () {
        soldier = []
        pushSoldier = n => () => soldier.push(n)
    })

    it ('should curryable', function () {
        expect(isFunction(tp.after(tp.nop))).toBe(true)
    })

    it ('should trackFn eval after fn', function () {
        tp.after(pushSoldier('trackFn'), pushSoldier('fn'))()
        expect(soldier).toEqual(['fn', 'trackFn'])
    })

    it ('should after thenable object', function (done) {
        const thenableFn = (n) => () => new Promise(function(resolve) {
            setTimeout(() => resolve(pushSoldier(n)()),300)
        })

        tp.after(pushSoldier('trackFn'), thenableFn('fn'))().then(() => {
            expect(soldier).toEqual(['fn', 'trackFn'])
        }).then(done)
    })

    it ('should ignore trackFn throw', function () {
        const afterFn = tp.after(() => {throw new Error('stub throw')}, pushSoldier('fn'))
        expect(afterFn).not.toThrow()
        expect(soldier).toEqual(['fn'])
    })
})

describe('trackpoint track', function () {
    let soldier
    let pushSoldier
    beforeEach(function () {
        soldier = []
        pushSoldier = n => () => soldier.push(n)
    })

    it ('should can as decorator with class method and work well', function () {
        class SomeComponent {
            @tp.track(tp.before(pushSoldier('trackFn')))
            onClick () {
                pushSoldier('fn')()
            }
        }

        const component = new SomeComponent
        expect(component.onClick).not.toThrow()
        expect(soldier).toEqual(['trackFn','fn'])
    })
})

describe('trackpoint compose', function () {
    it ('should can composeWith function', function () {
        const nop = tp.nop
        expect(isFunction(tp.composeWith(() => nop, [() => nop, () => nop]))).toBe(true)
    })

    it ('should can compose function', function () {
        const composeWith = tp.composeWith
        const spy = jasmine.createSpy('fn')
        let soldier = 0;
        const composeFn = composeWith(
            time => (...args) => soldier = time,
            [
                (fn) => (...args) => {
                    fn.apply(null, args);
                    return 253;
                }
            ])(spy)

        //invoke
        expect(() => composeFn('stub', 'args')).not.toThrow()
        // fn have been called
        expect(spy).toHaveBeenCalled()
        // fn called with correct args
        expect(spy).toHaveBeenCalledWith('stub', 'args')
        // trackFn called correct
        expect(soldier).toEqual(253)
    })

    it ('should no-side-effect', function () {
        const composeWith = tp.composeWith
        const identity = a => a

        const composeFn = composeWith((ms) => (...args) => {
            expect(args).toEqual([10])
            expect(ms).toEqual(100)
        }, (fn) => (...args) => {
            fn.apply(this, args)
            return 100
        })(identity)

        expect(composeFn(10)).toEqual(10)
    })
})

describe('trackpoint time', function () {
    it ('should have time', function () {
        expect(isFunction(tp.time)).toBe(true)
    })

    it ('should be measure normal function', function () {
        const time = tp.time
        const ms = time((s) => 'out' + 'pi' + 'ss' + s)(100)

        expect(ms < 10).toBe(true)
    })

    it ('should can test ms', function (done) {
        const composeWith = tp.composeWith
        const time = tp.time
        const after = tp.after
        const nop = tp.nop
        const track = tp.track

        const spy = jasmine.createSpy('fn')
        const fn = (ns) => {
            spy(ns)
            return new Promise(resolve => setTimeout(() => resolve(ns), ns))
        }

        let _MS
        const printMs = ms => (...args) => _MS = ms

        class SomeComponent {
            @track(composeWith(printMs, time))
            onClick (ms) {
                return fn(ms)
            }
        }

        (new SomeComponent).onClick(100).then((ms) => {
            _MS.then((_MS_) => {
                expect(spy.calls.count()).toEqual(1)
                expect(spy).toHaveBeenCalledWith(100)
                expect(ms).toEqual(100)
                expect(_MS_ >= 100).toBe(true)
                expect(_MS_ <= 120).toBe(true)
                done()
            })
        })
    })
})


describe('trackpoint evolve', function () {
    it ('should be a function', function () {
        expect(isFunction(tp.evolve)).toBe(true)
    })

    it ('should be work with single key:value', function () {
        const evolve = tp.evolve
        const composeWith = tp.composeWith
        const track = tp.track

        const evols = {
            time: tp.time
        }
        const spy = jasmine.createSpy('fn')
        const trackFn = ({time}) => (...args) => {
            expect(time <= 10).toBe(true)
            expect(time >= 0).toBe(true)
            expect(spy.calls.count()).toEqual(1)
        }

        class SomeComponent  {
            @track(composeWith(trackFn, evolve(evols)))
            onClick () {
                spy()
                return 100;
            }
        }

        expect((new SomeComponent).onClick()).toEqual(100)
    })

    it ('should be work with complicate evols', function () {
        const evolve = tp.evolve
        const composeWith = tp.composeWith
        const evols = {
            time1: tp.time,
            time2: tp.time,
            time3: tp.time
        }
        const track = tp.track
        const spy = jasmine.createSpy('fn')
        const trackFn = ({time1, time2, time3}) => (...args) => {
            expect(spy.calls.count()).toEqual(1)
            expect(time1 <= 100).toBe(true)
            expect(time1 >= 0).toBe(true)
            expect(time2 <= 5).toBe(true)
            expect(time3 <= 5).toBe(true)
        }

        class SomeComponent {
            @track(composeWith(trackFn, evolve(evols)))
            onClick() {
                let i = 10000000;
                while(i--);
                spy()
                return 301;
            }
        }


        expect((new SomeComponent).onClick()).toEqual(301)
    })
})


describe('trackpoint identity', function () {
    it ('should be a function', function () {
        expect(isFunction(tp.identity)).toBe(true)
    })

    it ('should return origin value', function () {
        const track = tp.track
        const identity = tp.identity
        const composeWith = tp.composeWith
        const trackFn = (value) => (...args) => {
            expect(value).toEqual('hello,world')
        }
        class SomeComponent {
            @track(composeWith(trackFn, identity))
            onClick() {
                return 'hello,world'
            }
        }

        expect((new SomeComponent).onClick()).toEqual('hello,world')
    })
})
