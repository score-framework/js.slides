/**
 * Copyright © 2015 STRG.AT GmbH, Vienna, Austria
 *
 * This file is part of the The SCORE Framework.
 *
 * The SCORE Framework and all its parts are free software: you can redistribute
 * them and/or modify them under the terms of the GNU Lesser General Public
 * License version 3 as published by the Free Software Foundation which is in the
 * file named COPYING.LESSER.txt.
 *
 * The SCORE Framework and all its parts are distributed without any WARRANTY;
 * without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
 * PARTICULAR PURPOSE. For more details see the GNU Lesser General Public
 * License.
 *
 * If you have not received a copy of the GNU Lesser General Public License see
 * http://www.gnu.org/licenses/.
 *
 * The License-Agreement realised between you as Licensee and STRG.AT GmbH as
 * Licenser including the issue of its valid conclusion and its pre- and
 * post-contractual effects is governed by the laws of Austria. Any disputes
 * concerning this License-Agreement including the issue of its valid conclusion
 * and its pre- and post-contractual effects are exclusively decided by the
 * competent court, in whose district STRG.AT GmbH has its registered seat, at
 * the discretion of STRG.AT GmbH also the competent court, in whose district the
 * Licensee has his registered seat, an establishment or assets.
 */

// Universal Module Loader
// https://github.com/umdjs/umd
// https://github.com/umdjs/umd/blob/v1.0.0/returnExports.js
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(['bluebird', 'score.init', 'score.dom', 'score.oop'], factory);
    } else if (typeof module === 'object' && module.exports) {
        // Node. Does not work with strict CommonJS, but
        // only CommonJS-like environments that support module.exports,
        // like Node.
        module.exports = factory(require('bluebird'), require('score.init'), require('score.dom'), require('score.oop'));
    } else {
        // Browser globals (root is window)
        factory(Promise, root.score);
    }
}(this, function(BPromise, score) {

    score.extend('dom.slides', ['oop'], function() {

        return score.oop.Class({
            __name__: 'Slides',

            __static__: {

                VERSION: "0.2.0",

            },

            __events__: [
                'change',
                'transitionStart',
                'transitionComplete'
            ],

            __init__: function(self, config) {
                self.config = config;
                var uiconf = {};
                for (var key in config) {
                    if (key.indexOf('ui-') === 0) {
                        uiconf[key.substr(3)] = config[key];
                    }
                }
                self.currentSlideNum = 0;
                self.ui = new config.ui(self, uiconf);
            },

            next: function(self) {
                if (self.isLastSlide()) {
                    self.slideTo(0, true);
                } else {
                    self.slideTo(self.currentSlideNum + 1, true);
                }
            },

            prev: function(self) {
                if (self.isFirstSlide()) {
                    self.slideTo(self.numSlides() - 1, false);
                } else {
                    self.slideTo(self.currentSlideNum - 1, false);
                }
            },

            slideTo: function(self, index, isForward) {
                if (self.currentSlideNum === index) {
                    return;
                }
                var previous = self.currentSlideNum;
                if (self.numSlides() <= index || index < 0) {
                    return;
                }
                if (!self.trigger('change', index, isForward)) {
                    return;
                }
                self.trigger('transitionStart', {
                    current: self.currentSlideNum,
                    next: index
                });
                self.currentSlideNum = index;
                if (self.transition && !self.transition.isFulfilled) {
                    self.transition.cancel();
                }
                self.transition = self.ui.transition(previous, index, isForward);
                self.transition.then(function() {
                    self.trigger('transitionComplete', {
                        previous: previous,
                        current: self.currentSlideNum
                    });
                    self.transition = null;
                });
            },

            isFirstSlide: function(self) {
                return self.currentSlideNum === 0;
            },

            isLastSlide: function(self) {
                return self.currentSlideNum === self.numSlides() - 1;
            },

            numSlides: function(self) {
                return self.ui.numSlides();
            }

        });

    });

    score.extend('dom.slides.ui', ['oop'], function() {

        var isTouchDevice = 'ontouchstart' in window;

        return {

            'default': oop.Class({
                __name__: 'DefaultSlidesUI',

                _currentLeft: 0,

                __init__: function(self, slider, config) {
                    self.slider = slider;
                    self.config = config;
                    self.node = score.dom(config.node);
                    self.slideNodes = [];
                    self.node.addClass('slides');
                    self.node.addClass('is-first');
                    self.width = self.node.offsetWidth;
                    self._initSlides();
                    self._initNextButton();
                    self._initPreviousButton();
                    if (self.numSlides() <= 1) {
                        self.node.addClass('is-last');
                    }
                    window.addEventListener('resize', self._windowResized);
                    if (isTouchDevice) {
                        self.slideWidth = self.node.offsetWidth;
                    }
                    self.node.addEventListener('touchstart', self._touchStartHandler);
                },

                transition: function(self, from, to, isForward) {
                    if (self.slider.isFirstSlide()) {
                        self.node.addClass('is-first');
                    } else {
                        self.node.removeClass('is-first');
                    }
                    if (self.slider.isLastSlide()) {
                        self.node.addClass('is-last');
                    } else {
                        self.node.removeClass('is-last');
                    }
                    var left = -self.width * to;
                    return new BPromise(function(resolve, reject) {
                        self.ul.style.transform = 'translateX(' + left + 'px)';
                        self.ul.style.webkitTransform = 'translateX(' + left + 'px)';
                        self.ul.style.msTransform = 'translateX(' + left + 'px)';
                        self._currentLeft = left;
                    });
                },

                numSlides: function(self) {
                    return self.slideNodes.length;
                },

                _initSlides: function(self) {
                    self.ul = document.createElement('ul');
                    self.ul.className = 'slides__list';
                    self.ul.style.width = self.width * self.config.nodes.length + 'px';
                    self.ul.style.display = 'block';
                    self.node.appendChild(self.ul);
                    self.config.nodes = Array.prototype.slice.call(self.config.nodes);
                    for (var i = 0; i < self.config.nodes.length; i++) {
                        var li = document.createElement('li');
                        li.style.width = self.width + 'px';
                        li.className = 'slides__slide';
                        li.appendChild(self.config.nodes[i]);
                        self.slideNodes.push(li);
                        self.ul.appendChild(li);
                    }
                },

                _initNextButton: function(self) {
                    self.nextButton = document.createElement('button');
                    self.nextButton.innerHTML = 'next';
                    self.nextButton.className = 'slides__button--next';
                    self.nextButton.addEventListener('click', function() {
                        if (!self.slider.isLastSlide()) {
                            self.slider.next();
                        }
                    });
                    self.node.appendChild(self.nextButton);
                },

                _initPreviousButton: function(self) {
                    self.prevButton = document.createElement('button');
                    self.prevButton.innerHTML = 'prev';
                    self.prevButton.className = 'slides__button--previous';
                    self.prevButton.addEventListener('click', function() {
                        if (!self.slider.isFirstSlide()) {
                            self.slider.prev();
                        }
                    });
                    self.node.appendChild(self.prevButton);
                },

                _windowResized: function(self) {
                    self.width = self.node.offsetWidth;
                    self.ul.style.width = (self.slideNodes.length * self.width) + 'px';
                    for (var i = 0; i < self.slideNodes.length; i++) {
                        self.slideNodes[i].style.width = self.width + 'px';
                    }
                    self.transition(0, self.slider.currentSlideNum, true);
                },

                _touchStartHandler: function(self, event) {
                    self.initialLeft = self._currentLeft;
                    self.initialMouseLeft = self._touchLocation(event)[0];
                    self.initialMouseTop = self._touchLocation(event)[1];
                    self.maxLeftDistance = self.slideWidth * (self.slider.isFirstSlide() ? 0.1 : 1.1);
                    self.maxRightDistance = self.slideWidth * (self.slider.isLastSlide() ? 0.1 : 1.1);
                    self.node.addEventListener('touchmove', self._touchMoveInit);
                },

                _touchLocation: function(self, event) {
                    // android always returns [0,0] as event.pageX/.pageY and provides
                    // multiple coordinates of multi-touch capable devices as
                    // event.changedTouches.
                    if (typeof event.changedTouches !== 'undefined') {
                        return [event.changedTouches[0].pageX, event.changedTouches[0].pageY];
                    }
                    return [event.pageX, event.pageY];
                },

                _touchMoveInit: function(self, event) {
                    self.horizontalDistance = self.initialMouseLeft - self._touchLocation(event)[0];
                    self.verticalDistance = self.initialMouseTop - self._touchLocation(event)[1];
                    self.node.removeEventListener('touchmove', self._touchMoveInit);
                    if (Math.abs(self.horizontalDistance) <= Math.abs(self.verticalDistance)) {
                        // the movement was not from left to tight or right to left
                        // but from top to bottom or bottom to top.
                        return;
                    }
                    document.addEventListener('touchend', self._touchEndHandler);
                    document.addEventListener('touchcancel', self._touchCancelHandler);
                    self.node.addEventListener('touchmove', self._touchMoveHandler);
                    event.preventDefault();
                    return false;
                },

                _touchMoveHandler: function(self, event) {
                    var currentMouseLeft = self._touchLocation(event)[0];
                    var distance = currentMouseLeft - self.initialMouseLeft,
                        relativeDistance,
                        adjustedDistance;
                    if (distance < 0) {
                        relativeDistance = Math.min(1, -distance / self.maxRightDistance);
                        adjustedDistance = -self.maxRightDistance * (1 - Math.pow(1 - relativeDistance, 3));
                    } else {
                        relativeDistance = Math.min(1, distance / self.maxLeftDistance);
                        adjustedDistance = self.maxLeftDistance * (1 - Math.pow(1 - relativeDistance, 3));
                    }
                    self._currentLeft = Math.round(self.initialLeft + adjustedDistance);
                    self.ul.style.transform = 'translateX(' + self._currentLeft + 'px)';
                    self.ul.style.webkitTransform = 'translateX(' + self._currentLeft + 'px)';
                    self.ul.style.msTransform = 'translateX(' + self._currentLeft + 'px)';
                },

                _touchEndHandler: function(self, event) {
                    document.removeEventListener('touchend', self._touchEndHandler);
                    document.removeEventListener('touchcancel', self._touchCancelHandler);
                    self.node.removeEventListener('touchmove', self._touchMoveHandler);
                    if (self._touchLocation(event)[0] != self.initialMouseLeft) {
                        if (self._touchLocation(event)[0] > self.initialMouseLeft && self.slider.currentSlideNum - 1 >= 0) {
                            self.slider.prev();
                        } else if (self._touchLocation(event)[0] < self.initialMouseLeft && self.slider.currentSlideNum + 1 < self.slider.numSlides()) {
                            self.slider.next();
                        } else {
                            self._resetSlidePosition();
                        }
                        event.preventDefault();
                        return false;
                    }
                },

                _touchCancelHandler: function(self, event) {
                    document.removeEventListener('touchend', self._touchEndHandler);
                    document.removeEventListener('touchcancel', self._touchCancelHandler);
                    self.node.removeEventListener('touchmove', self._touchMoveHandler);
                    self._resetSlidePosition();
                },

                _resetSlidePosition: function(self) {
                    self.ul.style.transform = 'translateX(' + self.initialLeft + 'px)';
                    self.ul.style.webkitTransform = 'translateX(' + self.initialLeft + 'px)';
                    self.ul.style.msTransform = 'translateX(' + self.initialLeft + 'px)';
                }

            })

        };

    });
}));
